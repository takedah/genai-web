// 添付ファイルの S3 取得・検証に失敗したことを表すエラー。
// bedrockApi 側でこの型を判別し、ユーザー向けメッセージを出し分ける。
export class FileRetrievalError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'FileRetrievalError';
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

// s3://{bucket}/{key} 形式の S3 URI をパースする。
// フロント（packages/web/src/lib/fileApi.ts getS3Uri）が送る形式に対応する。
const S3_URI_PATTERN = /^s3:\/\/(?<bucket>[^/]+)\/(?<key>.+)$/;

export type ParsedS3Uri = {
  bucket: string;
  // URL エンコードされたままの key（s3 URI 上の表記）
  encodedKey: string;
  // GetObjectCommand に渡すためにデコードした key
  key: string;
};

// s3 URI をパースし、bucket と key（デコード済み）を返す。
// key の filename 部分は署名付き URL 由来で URL エンコードされている可能性があるため
// decodeURIComponent で復号する（既存のダウンロード/削除経路と同じ扱い）。
export const parseS3Uri = (s3Uri: string): ParsedS3Uri | undefined => {
  const match = S3_URI_PATTERN.exec(s3Uri);
  if (!match?.groups) {
    return undefined;
  }
  const { bucket, key: encodedKey } = match.groups;
  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    // 不正なエンコード（孤立した % など）の場合はパース失敗扱い
    return undefined;
  }
  return { bucket, encodedKey, key };
};
