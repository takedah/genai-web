import { readFileSync } from 'node:fs';
import type { EstimatedCostSummary } from 'genai-web';
import { buildSummary } from './estimatedCostSummary';
// modelPricing.json は esbuild にバンドルさせるため import で取り込む。
// require() ではなく JSON モジュールの import を使うことで、Lambda のホットパスで FS を叩かない。
import bundledPricing from './modelPricing.json';
import type { RawTokenUsage } from './models';

// 単価カテゴリ識別子（マジックストリング回避）。
const TOKEN_CATEGORIES = {
  inputTokens: 'inputTokens',
  outputTokens: 'outputTokens',
  cacheReadInputTokens: 'cacheReadInputTokens',
  cacheWriteInputTokens: 'cacheWriteInputTokens',
} as const;

const DEFAULT_CURRENCY = 'USD';

type TokenCategoryEntry = {
  unitPrice: number;
};

type ModelPricingEntry = {
  currency?: string;
  pricingUnit: number;
  tokenCategories: Partial<Record<keyof typeof TOKEN_CATEGORIES, TokenCategoryEntry>>;
};

type ModelPricingFile = {
  models?: Record<string, ModelPricingEntry>;
};

// pricing 定義済みモデル ID → 検証済みエントリ。
export type PricingRegistry = Record<string, ModelPricingEntry>;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const validateEntry = (modelId: string, entry: unknown): ModelPricingEntry | undefined => {
  if (!entry || typeof entry !== 'object') {
    console.warn(`Skip pricing entry: ${modelId} (not an object)`);
    return undefined;
  }
  const e = entry as Partial<ModelPricingEntry>;
  if (!isFiniteNumber(e.pricingUnit) || e.pricingUnit <= 0) {
    console.warn(`Skip pricing entry: ${modelId} (invalid pricingUnit)`);
    return undefined;
  }
  if (!e.tokenCategories || typeof e.tokenCategories !== 'object') {
    console.warn(`Skip pricing entry: ${modelId} (missing tokenCategories)`);
    return undefined;
  }
  const validated: ModelPricingEntry = {
    pricingUnit: e.pricingUnit,
    currency: typeof e.currency === 'string' ? e.currency : DEFAULT_CURRENCY,
    tokenCategories: {},
  };
  for (const key of Object.values(TOKEN_CATEGORIES)) {
    const cat = (e.tokenCategories as Record<string, unknown>)[key];
    if (!cat || typeof cat !== 'object') continue;
    const unitPrice = (cat as { unitPrice?: unknown }).unitPrice;
    if (!isFiniteNumber(unitPrice)) {
      console.warn(`Skip pricing category: ${modelId}/${key} (invalid unitPrice)`);
      continue;
    }
    validated.tokenCategories[key as keyof typeof TOKEN_CATEGORIES] = { unitPrice };
  }
  // 最低限 inputTokens / outputTokens いずれかが定義されていなければ採用しない。
  if (
    validated.tokenCategories.inputTokens === undefined &&
    validated.tokenCategories.outputTokens === undefined
  ) {
    console.warn(`Skip pricing entry: ${modelId} (no usable token categories)`);
    return undefined;
  }
  return validated;
};

// 与えられた pricing データから PricingRegistry を構築する。
// 不正 JSON / 個別モデル定義不正は warn ログ＋空（または部分）レジストリにフォールバック。
// オプションの filePath を渡した場合は、その JSON を読み込んで使う（テスト・差し替え用途）。
export const loadPricing = (filePath?: string): PricingRegistry => {
  let parsed: ModelPricingFile;
  if (filePath !== undefined) {
    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch (e) {
      console.warn(`Pricing file not readable: ${filePath}`, e);
      return {};
    }
    try {
      parsed = JSON.parse(raw) as ModelPricingFile;
    } catch (e) {
      console.warn(`Pricing file invalid JSON: ${filePath}`, e);
      return {};
    }
  } else {
    parsed = bundledPricing as ModelPricingFile;
  }
  const models = parsed.models;
  if (!models || typeof models !== 'object') {
    console.warn('Pricing data has no models');
    return {};
  }
  const registry: PricingRegistry = {};
  for (const [modelId, entry] of Object.entries(models)) {
    const validated = validateEntry(modelId, entry);
    if (validated) registry[modelId] = validated;
  }
  return registry;
};

const defaultRegistry: PricingRegistry = loadPricing();

// 推定コスト計算。pricing 未定義 / raw 不在 / 全カテゴリ 0 トークンの場合は undefined を返す。
// 通貨は modelPricing.json の `currency`（既定 'USD'）。
export const estimateCost = (
  modelId: string,
  raw: RawTokenUsage | undefined,
  registry: PricingRegistry = defaultRegistry,
): EstimatedCostSummary | undefined => {
  if (!raw) return undefined;
  const entry = registry[modelId];
  if (!entry) return undefined;

  const tokenSources: Array<[keyof typeof TOKEN_CATEGORIES, number]> = [
    [TOKEN_CATEGORIES.inputTokens, raw.inputTokens],
    [TOKEN_CATEGORIES.outputTokens, raw.outputTokens],
    [TOKEN_CATEGORIES.cacheReadInputTokens, raw.cacheReadInputTokens ?? 0],
    [TOKEN_CATEGORIES.cacheWriteInputTokens, raw.cacheWriteInputTokens ?? 0],
  ];

  let total = 0;
  let any = false;
  for (const [category, tokens] of tokenSources) {
    if (!isFiniteNumber(tokens) || tokens === 0) continue;
    const cat = entry.tokenCategories[category];
    if (!cat) continue;
    total += (tokens * cat.unitPrice) / entry.pricingUnit;
    any = true;
  }
  if (!any) return undefined;

  return buildSummary(total, entry.currency);
};
