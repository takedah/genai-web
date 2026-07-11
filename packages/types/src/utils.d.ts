import { GenerateImageParams, Model, UnrecordedMessage } from 'genai-web';

export type InvokeInterface = (
  model: Model,
  messages: UnrecordedMessage[],
  id: string,
  // 添付ファイルの S3 取得時に所有者チェックへ使う Cognito Identity ID。
  // s3 ソースを処理する場合は必須（未指定ならエラー）。base64 のみの経路では省略可。
  identityId?: string,
) => Promise<string>;

export type InvokeStreamInterface = (
  model: Model,
  messages: UnrecordedMessage[],
  id: string,
  // 添付ファイルの S3 取得時に所有者チェックへ使う Cognito Identity ID。
  // s3 ソースを処理する場合は必須（未指定ならエラー）。base64 のみの経路では省略可。
  identityId?: string,
) => AsyncIterable<string>;

// Base64 にエンコードした画像を Return する
export type GenerateImageInterface = (model: Model, params: GenerateImageParams) => Promise<string>;

export type ApiInterface = {
  invoke: InvokeInterface;
  invokeStream: InvokeStreamInterface;
  generateImage: GenerateImageInterface;
};

export type ErrorResponse = {
  error: string;
};
