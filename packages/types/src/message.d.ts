import { PrimaryKey } from './base';
import { EstimatedCostSummary } from './cost';

export type Role = 'system' | 'user' | 'assistant';

export type Model = {
  type: 'bedrock' | 'sagemaker';
  modelId: string;
  sessionId?: string;
};

export type MessageAttributes = {
  messageId: string;
  usecase: string;
  userId: string;
  feedback: string;
};

export type ChatUsage = {
  model: string;
  provider?: string;
  // コスト計算には別途非キャッシュ生値を用いる。
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  latencyMs?: number;
};

// 1 生成 = 1 エントリ。assistant メッセージは UsageCostEntry[] (n セット) を保持する。
export type UsageCostEntry = {
  usage: ChatUsage;
  // pricing 未定義 / usage 不在では undefined。
  estimatedCost?: EstimatedCostSummary;
};

export type UnrecordedMessage = {
  role: Role;
  // テキスト
  content: string;
  // 追加データ（画像など）
  trace?: string;
  extraData?: ExtraData[];
  llmType?: string;
  // 1 生成 = 1 要素の usage / estimatedCost 履歴（n セット保存）。
  // 後方互換のため optional。継承先 (RecordedMessage / ToBeRecordedMessage) でも有効。
  usageCostHistory?: UsageCostEntry[];
};

export type ExtraData = {
  type: 'image' | 'video' | 'file' | 'json';
  name: string;
  source: {
    type: 's3' | 'base64' | 'json';
    mediaType: string; // mime type (i.e. image/png, text/plain, application/pdf, application/json)
    data: string; // s3 location for s3, data for base64, json for json
  };
};

export type UploadedFileType = {
  file: File;
  name: string;
  type: 'image' | 'video' | 'file';
  base64EncodedData?: string;
  s3Url?: string;
  uploading: boolean;
  deleting?: boolean;
  errorMessages: string[];
};

export type FileLimit = {
  accept: {
    doc: string[];
    image: string[];
    video: string[];
  };
  maxFileCount: number;
  maxFileSizeMB: number;
  maxImageFileCount: number;
  maxImageFileSizeMB: number;
  maxVideoFileCount: number;
  maxVideoFileSizeMB: number;
};

export type RecordedMessage = PrimaryKey & MessageAttributes & UnrecordedMessage;

export type ToBeRecordedMessage = UnrecordedMessage & {
  createdDate?: string;
  messageId: string;
  usecase: string;
};

export type ShownMessage = Partial<PrimaryKey> & Partial<MessageAttributes> & UnrecordedMessage;

export type DocumentComment = {
  excerpt: string;
  replace?: string;
  comment?: string;
};
