import {
  ContentBlock,
  ConversationRole,
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { modelMetadata } from '@genai-web/common';
import {
  AmazonAdvancedImageParams,
  AmazonGeneralImageParams,
  BedrockImageGenerationResponse,
  ConverseInferenceParams,
  ExtraData,
  GenerateImageParams,
  GuardrailConverseConfigParams,
  GuardrailConverseStreamConfigParams,
  Model,
  PromptTemplate,
  StabilityAI2024ModelParams,
  StabilityAI2024ModelResponse,
  StableDiffusionParams,
  UnrecordedMessage,
  UsecaseConverseInferenceParams,
} from 'genai-web';
import { toSafeDocumentName } from './fileNameUtils';
import { authorizeOwnedKey } from './fileOwnership';
import { FileRetrievalError, parseS3Uri } from './s3Uri';

// Bedrock Converse の 1 リクエストあたりの上限。会話履歴をまたいで累積するため、
// 送信時に新しい順で最新 N 件のみを残す（古い添付は LLM に渡らない）。
const MAX_DOCUMENTS_PER_REQUEST = 5;
const MAX_IMAGES_PER_REQUEST = 20;

// Default Models

export const modelIds: string[] = (JSON.parse(process.env.MODEL_IDS || '[]') as string[])
  .map((modelId: string) => modelId.trim())
  .filter((modelId: string) => modelId);
// 利用できるモデルの中で軽量モデルがあれば軽量モデルを優先する。
const lightWeightModelIds = modelIds.filter(
  (modelId: string) => modelMetadata[modelId].flags.light,
);
const defaultModelId = lightWeightModelIds[0] || modelIds[0];
export const defaultModel: Model = {
  type: 'bedrock',
  modelId: defaultModelId,
};

export const imageGenerationModelIds: string[] = (
  JSON.parse(process.env.IMAGE_GENERATION_MODEL_IDS || '[]') as string[]
)
  .map((name: string) => name.trim())
  .filter((name: string) => name);
export const defaultImageGenerationModel: Model = {
  type: 'bedrock',
  modelId: imageGenerationModelIds[0],
};

// Prompt Templates

const LLAMA_PROMPT: PromptTemplate = {
  prefix: '<s>[INST] ',
  suffix: ' [/INST]',
  join: '',
  user: '{}',
  assistant: ' [/INST] {}</s><s>[INST] ',
  system: '<<SYS>>\n{}\n<</SYS>>\n\n',
  eosToken: '</s>',
};

const BILINGUAL_RINNA_PROMPT: PromptTemplate = {
  prefix: '',
  suffix: 'システム: ',
  join: '\n',
  user: 'ユーザー: {}',
  assistant: 'システム: {}',
  system: 'システム: {}',
  eosToken: '</s>',
};

const RINNA_PROMPT: PromptTemplate = {
  prefix: '',
  suffix: 'システム: ',
  join: '<NL>',
  user: 'ユーザー: {}',
  assistant: 'システム: {}',
  system: 'システム: {}',
  eosToken: '</s>',
};

// Model Params
const CLAUDE_SONNET_4_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  maxTokens: 16384,
  temperature: 0,
};

const CLAUDE_SONNET_4_6_DEFAULT_PARAMS: ConverseInferenceParams = {
  maxTokens: 16384,
  temperature: 0,
};

// Claude Opus 4.8 は temperature パラメータが非対応（deprecated）のため、
// temperature を指定せず maxTokens のみを設定する。
const CLAUDE_OPUS_4_8_DEFAULT_PARAMS: ConverseInferenceParams = {
  maxTokens: 16384,
};

const CLAUDE_HAIKU_4_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  maxTokens: 16384,
  temperature: 0,
};

const CLAUDE_3_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  maxTokens: 8192,
  temperature: 0,
  topP: 0.8,
};

const CLAUDE_DEFAULT_PARAMS: ConverseInferenceParams = {
  maxTokens: 4096,
  temperature: 0,
  topP: 0.8,
};

const TITAN_TEXT_DEFAULT_PARAMS: ConverseInferenceParams = {
  // Doc 上は 3072 まで受け付けるが、Converse API だと 3000 までしか受け付けなかったため、3000 を設定する。
  // 3072 が受け付けられるように修正されたら戻す。
  // https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-text.html
  maxTokens: 3000,
  temperature: 0,
  topP: 1.0,
};

const LLAMA_DEFAULT_PARAMS: ConverseInferenceParams = {
  maxTokens: 2048,
  temperature: 0,
  topP: 0.99,
};

const MISTRAL_DEFAULT_PARAMS: ConverseInferenceParams = {
  maxTokens: 8192,
  temperature: 0,
  topP: 0.99,
};

const MIXTRAL_DEFAULT_PARAMS: ConverseInferenceParams = {
  maxTokens: 4096,
  temperature: 0,
  topP: 0.99,
};

const COMMANDR_DEFAULT_PARAMS: ConverseInferenceParams = {
  maxTokens: 4000,
  temperature: 0,
  topP: 0.75,
};

const NOVA_DEFAULT_PARAMS: ConverseInferenceParams = {
  maxTokens: 5120,
  temperature: 0,
  topP: 0.9,
};

const USECASE_DEFAULT_PARAMS: UsecaseConverseInferenceParams = {
  '/rag': {
    temperature: 0,
  },
};

// Claude Opus 4.8 は temperature 非対応のため、ユースケース別パラメータでも
// temperature を指定しない（USECASE_DEFAULT_PARAMS の /rag.temperature を混入させない）。
const OPUS_4_8_USECASE_PARAMS: UsecaseConverseInferenceParams = {};

// guardrail 設定
const createGuardrailConfig = (): GuardrailConverseConfigParams | undefined => {
  if (
    process.env.GUARDRAIL_IDENTIFIER !== undefined &&
    process.env.GUARDRAIL_VERSION !== undefined
  ) {
    return {
      guardrailIdentifier: process.env.GUARDRAIL_IDENTIFIER,
      guardrailVersion: process.env.GUARDRAIL_VERSION,
      // 出力が重くなる&現状トレースを確認する手段がアプリ側に無いので disabled をハードコーディング
      trace: 'disabled',
    };
  }
  return undefined;
};

const createGuardrailStreamConfig = (): GuardrailConverseStreamConfigParams | undefined => {
  const baseConfig = createGuardrailConfig();
  if (baseConfig) {
    return {
      ...baseConfig,
      // 非同期だとマズい出力が出る可能性があるが、まずい入力をしない限り出力が出たことがない（＝入力時点でストップ）ので、
      // 非同期で体験を良くすることとする
      // https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-streaming.html
      streamProcessingMode: 'async',
    };
  }
  return undefined;
};

// ID変換ルール
const idTransformationRules = [
  // チャット履歴 -> チャット
  { pattern: /^\/chat\/.+/, replacement: '/chat' },
];

// ID変換
function normalizeId(id: string): string {
  if (!id) return id;
  const rule = idTransformationRules.find((rule) => id.match(rule.pattern));
  const ret = rule ? rule.replacement : id;
  return ret;
}

// 会話プロンプトキャッシュ関連の定数（マジックストリング回避）
const CACHE_POINT_TYPE_DEFAULT = 'default' as const;
const CONVERSATION_CACHE_TTL_5M = '5m' as const;
// document と cachePoint を同居させると ValidationException になる format があるため、
// 同居可能と確認済みの format のみ許可する allowlist（deny by default）。
// Bedrock DocumentBlock.format の有効値は pdf|csv|doc|docx|xls|xlsx|html|txt|md だが、
// pdf 以外はテキスト抽出系で cachePoint と同居不可。pdf のみ同居可能と実環境で確認済み。
// https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_DocumentBlock.html
const CACHEABLE_DOCUMENT_FORMATS = new Set(['pdf']);
// idTransformationRules の replacement（チャット履歴 -> チャット）と一致させる
const CHAT_USECASE_ID = '/chat' as const;

// 会話（messages）部分のプロンプトキャッシュ方針（モデル単位の設定）。
// ttl 省略時は Bedrock デフォルト(5min)。Nova は ttl 明示不可のため省略する。
type ConversationCachePolicy = {
  ttl?: typeof CONVERSATION_CACHE_TTL_5M;
};

// id がチャット経路（/chat/... -> /chat に正規化）かどうか。
// 既存 normalizeId / idTransformationRules を流用し判定を一元化する。
// NOTE: テストから直接検証するため export している。
export const isChatUsecase = (id: string): boolean => normalizeId(id) === CHAT_USECASE_ID;

// conversation（user/assistant メッセージ配列）の最後の user メッセージの
// content 末尾に cachePoint を 1 個付与する。Strands SDK _inject_cache_point の
// 正規パターンに倣う。次ターンでは前ターンの最新発話までを含む prefix が完全一致し
// キャッシュ読み取り対象になる。
// NOTE: テストから直接検証するため export している。
export const appendCachePointToConversation = <
  T extends { role: ConversationRole; content: ContentBlock[] },
>(
  conversation: T[],
  policy: ConversationCachePolicy,
): T[] => {
  // 最後の user メッセージを探す
  let lastUserIdx = -1;
  for (let i = 0; i < conversation.length; i++) {
    if (conversation[i].role === ConversationRole.USER) lastUserIdx = i;
  }
  if (lastUserIdx === -1) return conversation; // user メッセージなし -> 付与しない

  // cachePoint と同居できない添付（テキスト抽出系 document・video 等）が末尾 user に
  // あると Bedrock が content ブロックを解釈できず ValidationException になるため付与しない。
  // 同居可能と確認済みの添付（image・pdf document）のみ許可する allowlist 方式（deny by default）。
  const hasUncacheableAttachment = conversation[lastUserIdx].content.some((block) => {
    if ('text' in block || 'image' in block) return false; // text・image は同居可能
    if ('document' in block) {
      const format = (block as ContentBlock.DocumentMember).document.format;
      return format === undefined || !CACHEABLE_DOCUMENT_FORMATS.has(format);
    }
    return true; // video 等、上記以外は同居不可とみなす
  });
  if (hasUncacheableAttachment) return conversation;

  const cachePoint = {
    type: CACHE_POINT_TYPE_DEFAULT,
    ...(policy.ttl ? { ttl: policy.ttl } : {}),
  };
  const target = conversation[lastUserIdx];
  const newContent = [...target.content, { cachePoint } as ContentBlock.CachePointMember];
  // 不変更新（元配列を破壊しない）
  return conversation.map((m, i) => (i === lastUserIdx ? { ...m, content: newContent } : m));
};

// API の呼び出しや、出力から文字列を抽出、などの処理

let s3Client: S3Client | undefined;
const getS3Client = (): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({});
  }
  return s3Client;
};

// 会話履歴の全 extraData のうち、Converse に渡す対象（保持対象）を判定する。
// document / image は新しいメッセージ順（配列末尾優先）で最新 N 件のみ true、
// それ以外（video 等）は常に true を返す。返り値は extra オブジェクトの Set。
const selectRetainedExtraData = (messages: UnrecordedMessage[]): Set<ExtraData> => {
  const retained = new Set<ExtraData>();
  let documentCount = 0;
  let imageCount = 0;
  // 新しいメッセージ＝配列末尾。末尾から走査して上限まで保持する。
  for (let i = messages.length - 1; i >= 0; i--) {
    const extraData = messages[i].extraData;
    if (!extraData) continue;
    // メッセージ内も後ろのファイルほど新しいとみなし、末尾から走査する。
    for (let j = extraData.length - 1; j >= 0; j--) {
      const extra = extraData[j];
      if (extra.type === 'file') {
        if (documentCount < MAX_DOCUMENTS_PER_REQUEST) {
          retained.add(extra);
          documentCount++;
        }
      } else if (extra.type === 'image') {
        if (imageCount < MAX_IMAGES_PER_REQUEST) {
          retained.add(extra);
          imageCount++;
        }
      } else {
        // video 等は件数制限の対象外
        retained.add(extra);
      }
    }
  }
  return retained;
};

// s3 ソースの image/file を S3 から取得して bytes（Buffer）化する。
// bucket 名検証・所有者チェック・key デコードを行う。
// s3 ソースを処理する場合 identityId は必須（未指定ならエラー）。
const fetchS3SourceBytes = async (
  extra: ExtraData,
  identityId: string | undefined,
): Promise<Buffer> => {
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    throw new FileRetrievalError('BUCKET_NAME is not configured');
  }

  const parsed = parseS3Uri(extra.source.data);
  if (!parsed) {
    throw new FileRetrievalError(`Invalid S3 URI: ${extra.name}`);
  }

  // bucket 名検証（任意 S3 オブジェクトの読み取り防止）
  if (parsed.bucket !== bucketName) {
    throw new FileRetrievalError(`S3 bucket mismatch for ${extra.name}`);
  }

  // 所有者チェック（IDOR 対策・deny by default）
  // s3 を処理する以上 identityId は必須。無ければ通さずエラーにする。
  if (!identityId?.trim()) {
    throw new FileRetrievalError('identityId is required to read an S3 attachment');
  }
  // 所有者チェック（IDOR 対策・deny by default）。
  // key 先頭セグメント（オーナー）が identityId と一致しなければ通さない。
  if (!authorizeOwnedKey(parsed.key, identityId.trim())) {
    throw new FileRetrievalError(`Access denied for ${extra.name}`);
  }

  try {
    const response = await getS3Client().send(
      new GetObjectCommand({ Bucket: bucketName, Key: parsed.key }),
    );
    const byteArray = await response.Body?.transformToByteArray();
    if (!byteArray) {
      throw new FileRetrievalError(`Empty S3 object for ${extra.name}`);
    }
    return Buffer.from(byteArray);
  } catch (e) {
    if (e instanceof FileRetrievalError) {
      throw e;
    }
    // SDK 例外（NoSuchKey 等）の文字列をユーザーへ露出させないよう汎用化しつつ、
    // 原因調査のため cause として元の例外を保持する。
    throw new FileRetrievalError(`Failed to fetch S3 object for ${extra.name}`, { cause: e });
  }
};

// NOTE: 会話 cachePoint 付与の検証のためテストから直接 import する。
export const createConverseCommandInput = async (
  messages: UnrecordedMessage[],
  id: string,
  modelId: string,
  defaultConverseInferenceParams: ConverseInferenceParams,
  usecaseConverseInferenceParams: UsecaseConverseInferenceParams,
  identityId?: string,
) => {
  // system role で渡された文字列を、システムプロンプトに設定
  const system = messages.find((message) => message.role === 'system');
  const systemContext = system ? [{ text: system.content }] : [];

  // system role 以外の、user role と assistant role の文字列を conversation に入れる
  messages = messages.filter((message) => message.role !== 'system');

  // 会話履歴をまたいで累積する Converse の件数上限を超えないよう、
  // document / image は新しい順で最新 N 件のみを Converse に渡す。
  const retainedExtraData = selectRetainedExtraData(messages);

  const documentIndexByExtra = new Map<ExtraData, number>();
  let documentIndexSeq = 0;
  for (const message of messages) {
    for (const extra of message.extraData ?? []) {
      if (extra.type === 'file' && retainedExtraData.has(extra)) {
        documentIndexByExtra.set(extra, documentIndexSeq++);
      }
    }
  }

  // 保持対象の s3 ソース（image/file）を直列で取得する。
  // 直列にすることで Lambda(256MB) の瞬間メモリ・帯域を抑える。最大25件の取得遅延は
  // 後続の LLM ストリーミング応答に対して小さく、体感への影響は限定的。
  const s3BytesByExtra = new Map<ExtraData, Buffer>();
  for (const message of messages) {
    for (const extra of message.extraData ?? []) {
      if (
        retainedExtraData.has(extra) &&
        (extra.type === 'image' || extra.type === 'file') &&
        extra.source.type === 's3'
      ) {
        s3BytesByExtra.set(extra, await fetchS3SourceBytes(extra, identityId));
      }
    }
  }

  const resolveBytes = (extra: ExtraData): Buffer => {
    if (extra.source.type !== 's3') {
      return Buffer.from(extra.source.data, 'base64');
    }
    const bytes = s3BytesByExtra.get(extra);
    if (!bytes) {
      throw new FileRetrievalError(`Missing S3 bytes for ${extra.name}`);
    }
    return bytes;
  };

  const conversation = messages.map((message) => {
    const contentBlocks: ContentBlock[] = [{ text: message.content } as ContentBlock.TextMember];

    if (message.extraData) {
      for (const extra of message.extraData) {
        if (!retainedExtraData.has(extra)) {
          continue;
        }

        if (extra.type === 'image') {
          contentBlocks.push({
            image: {
              format: extra.source.mediaType.split('/')[1],
              source: { bytes: resolveBytes(extra) },
            },
          } as ContentBlock.ImageMember);
        } else if (extra.type === 'file') {
          contentBlocks.push({
            document: {
              // Converse の DocumentBlock.format は小文字列挙のため小文字化する
              format: extra.name.split('.').pop()?.toLowerCase(),
              name: `${toSafeDocumentName(extra.name)}-${documentIndexByExtra.get(extra)}`,
              source: { bytes: resolveBytes(extra) },
            },
          } as ContentBlock.DocumentMember);
        } else if (extra.type === 'video' && extra.source.type === 'base64') {
          contentBlocks.push({
            video: {
              format: extra.source.mediaType.split('/')[1],
              source: { bytes: Buffer.from(extra.source.data, 'base64') },
            },
          } as ContentBlock.VideoMember);
        } else if (extra.type === 'video' && extra.source.type === 's3') {
          contentBlocks.push({
            video: {
              format: extra.source.mediaType.split('/')[1],
              source: { s3Location: { uri: extra.source.data } },
            },
          } as ContentBlock.VideoMember);
        }
      }
    }

    return {
      role: message.role === 'user' ? ConversationRole.USER : ConversationRole.ASSISTANT,
      content: contentBlocks,
    };
  });

  const usecaseParams = usecaseConverseInferenceParams[normalizeId(id)];
  const inferenceConfig = usecaseParams
    ? { ...defaultConverseInferenceParams, ...usecaseParams }
    : defaultConverseInferenceParams;

  const guardrailConfig = createGuardrailConfig();

  // チャット経路かつ会話キャッシュ対応モデルのとき、最後の user メッセージ末尾に
  // cachePoint を付与する。非対応モデル・非チャット経路では従来どおり無付与。
  const conversationCache = BEDROCK_TEXT_GEN_MODELS[modelId]?.conversationCache;
  const finalConversation =
    conversationCache && isChatUsecase(id)
      ? appendCachePointToConversation(conversation, conversationCache)
      : conversation;

  const converseCommandInput: ConverseCommandInput = {
    modelId: modelId,
    messages: finalConversation,
    system: systemContext,
    inferenceConfig: inferenceConfig,
    guardrailConfig: guardrailConfig,
  };

  return converseCommandInput;
};

// システムプロンプトに対応していないモデル用の関数
// - Amazon Titan モデル (amazon.titan-text-premier-v1:0)
// - Mistral AI Instruct (mistral.mixtral-8x7b-instruct-v0:1, mistral.mistral-7b-instruct-v0:2)
// https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html#conversation-inference-supported-models-features
// NOTE: system 非対応モデルでは会話 cachePoint を付与しないことをテストから検証するため export。
export const createConverseCommandInputWithoutSystemContext = async (
  messages: UnrecordedMessage[],
  id: string,
  modelId: string,
  defaultConverseInferenceParams: ConverseInferenceParams,
  usecaseConverseInferenceParams: UsecaseConverseInferenceParams,
  _identityId?: string,
) => {
  // system が利用できないので、system も user として入れる。
  messages = messages.filter((message) => message.role !== 'system');
  const conversation = messages.map((message) => ({
    role:
      message.role === 'user' || message.role === 'system'
        ? ConversationRole.USER
        : ConversationRole.ASSISTANT,
    content: [{ text: message.content }],
  }));

  const usecaseParams = usecaseConverseInferenceParams[normalizeId(id)];
  const inferenceConfig = usecaseParams
    ? { ...defaultConverseInferenceParams, ...usecaseParams }
    : defaultConverseInferenceParams;

  const guardrailConfig = createGuardrailConfig();

  const converseCommandInput: ConverseCommandInput = {
    modelId: modelId,
    messages: conversation,
    inferenceConfig: inferenceConfig,
    guardrailConfig: guardrailConfig,
  };

  return converseCommandInput;
};

// ConverseStreamCommandInput は、同じ構造を持つため「createConverseCommandInput」で作成したインプットをそのまま利用する。
// NOTE: ストリーム経路でも会話 cachePoint が付与されることをテストから検証するため export。
export const createConverseStreamCommandInput = async (
  messages: UnrecordedMessage[],
  id: string,
  modelId: string,
  defaultParams: ConverseInferenceParams,
  usecaseParams: UsecaseConverseInferenceParams,
  identityId?: string,
): Promise<ConverseStreamCommandInput> => {
  const converseCommandInput = await createConverseCommandInput(
    messages,
    id,
    modelId,
    defaultParams,
    usecaseParams,
    identityId,
  );
  const guardrailStreamConfig = createGuardrailStreamConfig();
  return {
    ...converseCommandInput,
    guardrailStreamConfig,
  } as ConverseStreamCommandInput;
};

// システムプロンプトに対応していないモデル用の関数
// - Amazon Titan モデル (amazon.titan-text-premier-v1:0)
// - Mistral AI Instruct (mistral.mixtral-8x7b-instruct-v0:1, mistral.mistral-7b-instruct-v0:2)
// https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html#conversation-inference-supported-models-features
const createConverseStreamCommandInputWithoutSystemContext = async (
  messages: UnrecordedMessage[],
  id: string,
  modelId: string,
  defaultParams: ConverseInferenceParams,
  usecaseParams: UsecaseConverseInferenceParams,
  identityId?: string,
): Promise<ConverseStreamCommandInput> => {
  const converseCommandInput = await createConverseCommandInputWithoutSystemContext(
    messages,
    id,
    modelId,
    defaultParams,
    usecaseParams,
    identityId,
  );
  const guardrailStreamConfig = createGuardrailStreamConfig();
  return {
    ...converseCommandInput,
    guardrailStreamConfig,
  } as ConverseStreamCommandInput;
};

const extractConverseOutputText = (output: ConverseCommandOutput): string => {
  if (output.output?.message?.content) {
    // output.message.content は配列になっているが、基本的に要素は 1 個しか返ってこないため、join をする必要はない。
    // ただ、安全側に実装することを意識して、配列に複数の要素が来ても問題なく動作するように、join で改行を付けるよ実装にしておく。
    const responseText = output.output.message.content.map((block) => block.text).join('\n');
    return responseText;
  }

  return '';
};

const extractConverseStreamOutputText = (output: ConverseStreamOutput): string => {
  if (output.contentBlockDelta?.delta?.text) {
    return output.contentBlockDelta.delta?.text;
  }

  return '';
};

// SDK 生のトークン内訳。コスト計算（Phase 4 で結合）には非キャッシュ input が必要なため、
// 集約済みの ChatUsage.inputTokens（キャッシュ込み）とは別に保持する。
export type RawTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
};

// Converse Stream の metadata イベントから usage を抽出する。
// Bedrock Converse Stream API の usage 構造は全モデル共通のため、
// BEDROCK_TEXT_GEN_MODELS テーブルにモデルごとの実装を持たない。
// 戻り値は `{ raw, totals }` の組:
//   - raw: コスト計算用の SDK 生値（非キャッシュ input + cache read/write）
//   - totals: 返却・保存用の集約値（input は cache 込みの合算、output / total を含む）
// usage が取得できなければ undefined。
export const extractConverseStreamUsage = (
  output: ConverseStreamOutput,
):
  | {
      raw: RawTokenUsage;
      totals: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        cacheReadTokens?: number;
        cacheWriteTokens?: number;
      };
    }
  | undefined => {
  const usage = output.metadata?.usage;
  if (!usage) return undefined;

  // SDK が undefined を返すフィールドは 0 として扱う。
  const rawInput = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const cacheRead = usage.cacheReadInputTokens;
  const cacheWrite = usage.cacheWriteInputTokens;

  const aggregatedInput = rawInput + (cacheRead ?? 0) + (cacheWrite ?? 0);
  const totalTokens = usage.totalTokens ?? aggregatedInput + outputTokens;

  return {
    raw: {
      inputTokens: rawInput,
      outputTokens,
      ...(cacheRead !== undefined ? { cacheReadInputTokens: cacheRead } : {}),
      ...(cacheWrite !== undefined ? { cacheWriteInputTokens: cacheWrite } : {}),
    },
    totals: {
      inputTokens: aggregatedInput,
      outputTokens,
      totalTokens,
      ...(cacheRead !== undefined && cacheRead > 0 ? { cacheReadTokens: cacheRead } : {}),
      ...(cacheWrite !== undefined && cacheWrite > 0 ? { cacheWriteTokens: cacheWrite } : {}),
    },
  };
};

const createBodyImageStableDiffusion = (params: GenerateImageParams) => {
  let body: StableDiffusionParams = {
    text_prompts: params.textPrompt,
    cfg_scale: params.cfgScale,
    style_preset: params.stylePreset,
    seed: params.seed,
    steps: params.step,
    image_strength: params.maskImage ? 0 : params.imageStrength, // Inpaint/Outpaint 時に 0 以上だと悪さする
    height: params.height,
    width: params.width,
  };
  if (params.initImage && params.maskImage === undefined) {
    // Image to Image
    body = {
      ...body,
      init_image: params.initImage,
    };
  } else if (params.initImage && params.maskImage) {
    // Image to Image (Masking)
    body = {
      ...body,
      init_image: params.initImage,
      mask_image: params.maskImage,
      mask_source: params.taskType === 'INPAINTING' ? 'MASK_IMAGE_BLACK' : 'MASK_IMAGE_WHITE',
    };
  }
  return JSON.stringify(body);
};

const createBodyImageStabilityAI2024Model = (params: GenerateImageParams) => {
  let positivePrompt: string = '';
  let negativePrompt: string | undefined;
  params.textPrompt.forEach((prompt) => {
    if (prompt.weight >= 0) {
      positivePrompt = prompt.text;
    } else {
      negativePrompt = prompt.text;
    }
  });
  if (!positivePrompt) {
    throw new Error('Positive prompt is required');
  }
  let body: StabilityAI2024ModelParams = {
    prompt: positivePrompt,
    seed: params.seed,
    output_format: 'png',
  };
  if (params.stylePreset) {
    body.prompt = body.prompt + ', ' + params.stylePreset;
  }

  // image-to-image modeの際、aspect比を使用できない
  if (params.aspectRatio && !params.initImage) {
    body = {
      ...body,
      aspect_ratio: params.aspectRatio,
    };
  }
  if (negativePrompt) {
    body = {
      ...body,
      negative_prompt: negativePrompt,
    };
  }

  // Image to Image
  if (params.initImage) {
    body = {
      ...body,
      image: params.initImage,
      mode: 'image-to-image',
      strength: params.imageStrength,
    };
  }
  return JSON.stringify(body);
};

const createBodyImageAmazonGeneralImage = (params: GenerateImageParams) => {
  const imageGenerationConfig = {
    numberOfImages: 1,
    quality: 'standard',
    height: params.height,
    width: params.width,
    cfgScale: params.cfgScale,
    seed: params.seed % 214783648, // max for titan image
  };
  let body: Partial<AmazonGeneralImageParams> = {};
  if (params.initImage && params.taskType === undefined) {
    body = {
      taskType: 'IMAGE_VARIATION',
      imageVariationParams: {
        text: (params.textPrompt.find((x) => x.weight > 0)?.text || '') + ', ' + params.stylePreset,
        negativeText: params.textPrompt.find((x) => x.weight < 0)?.text,
        images: [params.initImage],
        similarityStrength: Math.max(params.imageStrength || 0.2, 0.2), // Min 0.2
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  } else if (params.initImage && params.taskType === 'INPAINTING') {
    body = {
      taskType: 'INPAINTING',
      inPaintingParams: {
        text: (params.textPrompt.find((x) => x.weight > 0)?.text || '') + ', ' + params.stylePreset,
        negativeText: params.textPrompt.find((x) => x.weight < 0)?.text,
        image: params.initImage,
        maskImage: params.maskImage,
        maskPrompt: params.maskPrompt,
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  } else if (params.initImage && params.taskType === 'OUTPAINTING') {
    body = {
      taskType: 'OUTPAINTING',
      outPaintingParams: {
        text: (params.textPrompt.find((x) => x.weight > 0)?.text || '') + ', ' + params.stylePreset,
        negativeText: params.textPrompt.find((x) => x.weight < 0)?.text,
        image: params.initImage,
        maskImage: params.maskImage,
        maskPrompt: params.maskPrompt,
        outPaintingMode: 'DEFAULT',
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  } else {
    body = {
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text: (params.textPrompt.find((x) => x.weight > 0)?.text || '') + ', ' + params.stylePreset,
        negativeText: params.textPrompt.find((x) => x.weight < 0)?.text || '',
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  }
  return JSON.stringify(body);
};

const createBodyImageAmazonAdvancedImage = (params: GenerateImageParams) => {
  const baseBody = JSON.parse(createBodyImageAmazonGeneralImage(params));
  let body: Partial<AmazonAdvancedImageParams> = {
    ...baseBody,
  };

  if (params.taskType === 'COLOR_GUIDED_GENERATION') {
    body = {
      taskType: 'COLOR_GUIDED_GENERATION',
      colorGuidedGenerationParams: {
        text: params.textPrompt.find((x) => x.weight > 0)?.text || '',
        negativeText: params.textPrompt.find((x) => x.weight < 0)?.text,
        referenceImage: params.initImage,
        colors: params.colors!,
      },
      imageGenerationConfig: body.imageGenerationConfig,
    };
  } else if (params.taskType === 'BACKGROUND_REMOVAL') {
    body = {
      taskType: 'BACKGROUND_REMOVAL',
      backgroundRemovalParams: {
        image: params.initImage!,
      },
    };
  } else if (body.textToImageParams) {
    // TEXT_IMAGE タスクタイプの拡張(Image Conditioning)
    body.textToImageParams = {
      ...body.textToImageParams,
      conditionImage: params.initImage,
      controlMode: params.controlMode,
      controlStrength: params.controlStrength,
    };
  }
  return JSON.stringify(body);
};

const extractOutputImageStableDiffusion = (
  response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse,
) => {
  if ('result' in response) {
    // BedrockImageGenerationResponse の場合
    if (response.result !== 'success') {
      throw new Error('Failed to invoke model');
    }
    return response.artifacts[0].base64;
  } else {
    // StabilityAI2024ModelResponse の場合
    throw new Error('Unexpected response type for Stable Diffusion');
  }
};

const extractOutputImageStabilityAI2024Model = (
  response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse,
) => {
  if ('finish_reasons' in response) {
    // StabilityAI2024ModelResponse の場合
    if (response.finish_reasons[0] !== null) {
      if (response.finish_reasons[0] == 'Filter reason: prompt') {
        throw new Error(response.finish_reasons[0] + ': 日本語のプロンプトには対応していません');
      }
      throw new Error(response.finish_reasons[0]);
    }
    return response.images[0];
  } else {
    // BedrockImageGenerationResponse の場合
    throw new Error('Unexpected response type for Stability AI 2024 Model');
  }
};

const extractOutputImageAmazonImage = (
  response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse,
) => {
  if ('images' in response) {
    return response.images[0];
  } else {
    throw new Error('Unexpected response type for Amazon Image');
  }
};
// テキスト生成に関する、各のModel のパラメーターや関数の定義

export const BEDROCK_TEXT_GEN_MODELS: {
  [key: string]: {
    defaultParams: ConverseInferenceParams;
    usecaseParams: UsecaseConverseInferenceParams;
    promptCacheTtl?: 'none' | '5m' | '1h';
    // 会話（messages）部分のキャッシュ方針。フィールドの有無 = 会話キャッシュ対応可否。
    // system 用の promptCacheTtl とは独立（会話=5min、system=既存維持）。
    conversationCache?: ConversationCachePolicy;
    createConverseCommandInput: (
      messages: UnrecordedMessage[],
      id: string,
      modelId: string,
      defaultParams: ConverseInferenceParams,
      usecaseParams: UsecaseConverseInferenceParams,
      identityId?: string,
    ) => Promise<ConverseCommandInput>;
    createConverseStreamCommandInput: (
      messages: UnrecordedMessage[],
      id: string,
      modelId: string,
      defaultParams: ConverseInferenceParams,
      usecaseParams: UsecaseConverseInferenceParams,
      identityId?: string,
    ) => Promise<ConverseStreamCommandInput>;
    extractConverseOutputText: (body: ConverseCommandOutput) => string;
    extractConverseStreamOutputText: (body: ConverseStreamOutput) => string;
  };
} = {
  'jp.anthropic.claude-haiku-4-5-20251001-v1:0': {
    defaultParams: CLAUDE_HAIKU_4_5_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    promptCacheTtl: '1h',
    conversationCache: { ttl: CONVERSATION_CACHE_TTL_5M },
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'jp.anthropic.claude-sonnet-4-5-20250929-v1:0': {
    defaultParams: CLAUDE_SONNET_4_5_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    promptCacheTtl: '1h',
    conversationCache: { ttl: CONVERSATION_CACHE_TTL_5M },
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'jp.anthropic.claude-sonnet-4-6': {
    defaultParams: CLAUDE_SONNET_4_6_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    promptCacheTtl: '1h',
    conversationCache: { ttl: CONVERSATION_CACHE_TTL_5M },
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'jp.anthropic.claude-opus-4-8': {
    defaultParams: CLAUDE_OPUS_4_8_DEFAULT_PARAMS,
    usecaseParams: OPUS_4_8_USECASE_PARAMS,
    promptCacheTtl: '1h',
    conversationCache: { ttl: CONVERSATION_CACHE_TTL_5M },
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'apac.anthropic.claude-sonnet-4-20250514-v1:0': {
    defaultParams: CLAUDE_3_5_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'apac.anthropic.claude-3-7-sonnet-20250219-v1:0': {
    defaultParams: CLAUDE_3_5_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'apac.amazon.nova-pro-v1:0': {
    defaultParams: NOVA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    // Nova は ttl 明示不可のため省略（Bedrock デフォルト5min）。system キャッシュは未対応のまま。
    conversationCache: {},
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'apac.amazon.nova-micro-v1:0': {
    defaultParams: NOVA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    // Nova は ttl 明示不可のため省略（Bedrock デフォルト5min）。system キャッシュは未対応のまま。
    conversationCache: {},
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'anthropic.claude-3-5-sonnet-20241022-v2:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'anthropic.claude-3-5-haiku-20241022-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.anthropic.claude-3-5-haiku-20241022-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'anthropic.claude-3-5-sonnet-20240620-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.anthropic.claude-3-5-sonnet-20240620-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'eu.anthropic.claude-3-5-sonnet-20240620-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'apac.anthropic.claude-3-5-sonnet-20240620-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'anthropic.claude-3-opus-20240229-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.anthropic.claude-3-opus-20240229-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'anthropic.claude-3-sonnet-20240229-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.anthropic.claude-3-sonnet-20240229-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'eu.anthropic.claude-3-sonnet-20240229-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'apac.anthropic.claude-3-sonnet-20240229-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'anthropic.claude-3-haiku-20240307-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.anthropic.claude-3-haiku-20240307-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'eu.anthropic.claude-3-haiku-20240307-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'apac.anthropic.claude-3-haiku-20240307-v1:0': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'anthropic.claude-v2:1': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'anthropic.claude-v2': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'anthropic.claude-instant-v1': {
    defaultParams: CLAUDE_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'amazon.titan-text-express-v1': {
    defaultParams: TITAN_TEXT_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInputWithoutSystemContext,
    createConverseStreamCommandInput: createConverseStreamCommandInputWithoutSystemContext,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'amazon.titan-text-premier-v1:0': {
    defaultParams: TITAN_TEXT_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInputWithoutSystemContext,
    createConverseStreamCommandInput: createConverseStreamCommandInputWithoutSystemContext,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'meta.llama3-8b-instruct-v1:0': {
    defaultParams: LLAMA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'meta.llama3-70b-instruct-v1:0': {
    defaultParams: LLAMA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'meta.llama3-1-8b-instruct-v1:0': {
    defaultParams: LLAMA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'meta.llama3-1-70b-instruct-v1:0': {
    defaultParams: LLAMA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'meta.llama3-1-405b-instruct-v1:0': {
    defaultParams: LLAMA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.meta.llama3-2-1b-instruct-v1:0': {
    defaultParams: LLAMA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.meta.llama3-2-3b-instruct-v1:0': {
    defaultParams: LLAMA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.meta.llama3-2-11b-instruct-v1:0': {
    defaultParams: LLAMA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.meta.llama3-2-90b-instruct-v1:0': {
    defaultParams: LLAMA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.meta.llama3-3-70b-instruct-v1:0': {
    defaultParams: LLAMA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'mistral.mistral-7b-instruct-v0:2': {
    defaultParams: MISTRAL_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInputWithoutSystemContext,
    createConverseStreamCommandInput: createConverseStreamCommandInputWithoutSystemContext,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'mistral.mixtral-8x7b-instruct-v0:1': {
    defaultParams: MIXTRAL_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInputWithoutSystemContext,
    createConverseStreamCommandInput: createConverseStreamCommandInputWithoutSystemContext,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'mistral.mistral-small-2402-v1:0': {
    defaultParams: MISTRAL_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'mistral.mistral-large-2402-v1:0': {
    defaultParams: MISTRAL_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'mistral.mistral-large-2407-v1:0': {
    defaultParams: MISTRAL_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'cohere.command-r-v1:0': {
    defaultParams: COMMANDR_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'cohere.command-r-plus-v1:0': {
    defaultParams: COMMANDR_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },

  'amazon.nova-pro-v1:0': {
    defaultParams: NOVA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'amazon.nova-lite-v1:0': {
    defaultParams: NOVA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    promptCacheTtl: 'none',
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'amazon.nova-micro-v1:0': {
    defaultParams: NOVA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.amazon.nova-pro-v1:0': {
    defaultParams: NOVA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.amazon.nova-lite-v1:0': {
    defaultParams: NOVA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
  'us.amazon.nova-micro-v1:0': {
    defaultParams: NOVA_DEFAULT_PARAMS,
    usecaseParams: USECASE_DEFAULT_PARAMS,
    createConverseCommandInput: createConverseCommandInput,
    createConverseStreamCommandInput: createConverseStreamCommandInput,
    extractConverseOutputText: extractConverseOutputText,
    extractConverseStreamOutputText: extractConverseStreamOutputText,
  },
};

// 画像生成に関する、各のModel のパラメーターや関数の定義

export const BEDROCK_IMAGE_GEN_MODELS: {
  [key: string]: {
    createBodyImage: (params: GenerateImageParams) => string;
    extractOutputImage: (
      response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse,
    ) => string;
  };
} = {
  'stability.stable-diffusion-xl-v1': {
    createBodyImage: createBodyImageStableDiffusion,
    extractOutputImage: extractOutputImageStableDiffusion,
  },
  'stability.sd3-large-v1:0': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'stability.stable-image-core-v1:0': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'stability.stable-image-core-v1:1': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'stability.stable-image-ultra-v1:0': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'stability.stable-image-ultra-v1:1': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'stability.sd3-5-large-v1:0': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'amazon.titan-image-generator-v1': {
    createBodyImage: createBodyImageAmazonGeneralImage,
    extractOutputImage: extractOutputImageAmazonImage,
  },
  'amazon.titan-image-generator-v2:0': {
    createBodyImage: createBodyImageAmazonAdvancedImage,
    extractOutputImage: extractOutputImageAmazonImage,
  },
  'amazon.nova-canvas-v1:0': {
    createBodyImage: createBodyImageAmazonAdvancedImage,
    extractOutputImage: extractOutputImageAmazonImage,
  },
};

export const getSageMakerModelTemplate = (model: string): PromptTemplate => {
  if (model.includes('llama')) {
    return LLAMA_PROMPT;
  } else if (model.includes('bilingual-rinna')) {
    return BILINGUAL_RINNA_PROMPT;
  } else if (model.includes('rinna')) {
    return RINNA_PROMPT;
  }
  throw new Error('Invalid model name');
};
