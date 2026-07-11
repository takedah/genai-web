import { isUseCaseEnabled } from '@/utils/isUseCaseEnabled';

export type GenuAppKind = 'chat' | 'generate' | 'translate' | 'image' | 'diagram' | 'transcribe';

export type GenuAppMeta = {
  kind: GenuAppKind;
  label: string;
  description: string;
};

/**
 * GenU 系 AI アプリ（チャット/生成/翻訳/画像/ダイアグラム/文字起こし）のメタ情報。
 * useGenUApps、LandingPage のフォールバック表示、最近使ったアプリの記録などから参照される。
 */
export const GENU_APP_METAS: Record<GenuAppKind, GenuAppMeta> = {
  chat: { kind: 'chat', label: 'チャット', description: '着想や整理のための壁打ち' },
  generate: {
    kind: 'generate',
    label: '文章を生成',
    description: '手元の情報をもとに文章を作成',
  },
  translate: {
    kind: 'translate',
    label: '翻訳',
    description: '手元の文章を他の言語に翻訳',
  },
  image: {
    kind: 'image',
    label: '画像を生成',
    description: '文章や単語から画像を生成',
  },
  diagram: {
    kind: 'diagram',
    label: 'ダイアグラムを生成',
    description: 'テキストからフローチャートやマインドマップを作成',
  },
  transcribe: {
    kind: 'transcribe',
    label: '音声ファイルから文字起こし',
    description: '音声ファイルを元に文字起こし',
  },
};

/**
 * フィーチャーフラグ（hiddenUseCases）適用後の利用可能な GenU アプリ一覧を返す純関数。
 * チャット・文章生成・文字起こしは常時有効。
 */
export const getAvailableGenuApps = (): GenuAppMeta[] => [
  GENU_APP_METAS.chat,
  GENU_APP_METAS.generate,
  ...(isUseCaseEnabled('translate') ? [GENU_APP_METAS.translate] : []),
  ...(isUseCaseEnabled('image') ? [GENU_APP_METAS.image] : []),
  ...(isUseCaseEnabled('diagram') ? [GENU_APP_METAS.diagram] : []),
  GENU_APP_METAS.transcribe,
];
