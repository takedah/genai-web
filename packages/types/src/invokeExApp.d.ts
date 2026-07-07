import { EstimatedCostSummary } from './cost';

export type InvokeExAppRequest = {
  teamId: string;
  exAppId: string;
  inputs: Record<string, any>;
  sessionId?: string;
  // 注意: userId（安定ID）はHTTPヘッダー x-user-id で送信されるため、
  // リクエストBodyの型定義には含めない
};

// 実データ準拠のオブジェクト型。最小ガード（estimatedCost のみ必須）で
// プロバイダ間差異を吸収する。`[extra: string]: unknown` で未知フィールドを破棄せず透過。
export type EstimatedCostInfo = {
  estimatedCost: number;
  currency?: string;
  inputTokens?: number;
  outputTokens?: number;
  inputToken1KUnitPrice?: number;
  outputToken1KUnitPrice?: number;
  [extra: string]: unknown;
};

export type UsageMetadata = {
  estimatedCostInfo?: EstimatedCostInfo;
  modelVersion: string;
  requestCount: number;
  tokens: {
    // Gemini 系命名（外部アプリ応答透過用）。chat の ChatUsage とは別系統。
    candidatesTokenCount: number;
    promptTokenCount: number;
    totalTokenCount: number;
  };
};

export type InvokeExAppResponse = {
  outputs: string;
  artifacts?: {
    content: string;
    display_name: string;
  }[];
  timestamps: {
    processingEndedAt: string;
    processingStartedAt: string;
  };
  usageMetadata?: UsageMetadata[];
  totalEstimatedCost?: EstimatedCostSummary;
};

export type Artifact = {
  display_name: string;
  file_url: string;
};

export type ExAppInvokeStatus = 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ERROR';

export type InvokeExAppHistory = {
  teamId: string;
  teamName: string;
  exAppId: string;
  exAppName: string;
  userId: string;
  inputs: Record<string, any>;
  outputs: string;
  createdDate: string;
  status: ExAppInvokeStatus;
  progress: string;
  artifacts?: Artifact[];
  sessionId?: string;
  predictedTitle?: string;
  usageMetadata?: UsageMetadata[];
  totalEstimatedCost?: EstimatedCostSummary;
};

export type ListInvokeExAppHistoriesRequest = {
  teamId: string;
  exAppId: string;
  exclusiveStartKey: string | null;
};

export type ListInvokeExAppHistoriesResponse = {
  history: InvokeExAppHistory[];
  lastEvaluatedKey: string | null;
};

export type GetInvokeExAppHistoryResponse = {
  history: InvokeExAppHistory;
};
