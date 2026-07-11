import { FileLimit } from 'genai-web';

export const FILE_LIMIT: FileLimit = {
  accept: {
    doc: ['.csv', '.doc', '.docx', '.html', '.md', '.pdf', '.txt', '.xls', '.xlsx', '.gif'],
    image: ['.jpg', '.jpeg', '.png', '.webp'],
    video: ['.mkv', '.mov', '.mp4', '.webm'],
  },
  maxFileCount: 5,
  // doc・image とも Base64 エンコード後のサイズで検証する（MiB 基準）。
  // 4.5MB = convertSizeToBytes('4.5MB') = 4,718,592 バイト（= 4.5 * 1024 * 1024）。
  // Base64 後 4.5MiB は Bedrock の image 上限 5MB(base64後) 未満のため単体上限も満たす。
  maxFileSizeMB: 4.5,
  maxImageFileCount: 20,
  maxImageFileSizeMB: 4.5,
  maxVideoFileCount: 1,
  // video は S3 URI で送信されペイロードに乗らないため、生サイズで検証する（1 GB for S3 input）
  maxVideoFileSizeMB: 1000,
} as const;
