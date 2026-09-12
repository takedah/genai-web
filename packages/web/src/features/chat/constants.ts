import { FileLimit } from 'genai-web';

export const FILE_LIMIT: FileLimit = {
  accept: {
    doc: ['.csv', '.doc', '.docx', '.html', '.md', '.pdf', '.txt', '.xls', '.xlsx', '.gif'],
    image: ['.jpg', '.jpeg', '.png', '.webp'],
    video: ['.mkv', '.mov', '.mp4', '.webm'],
  },
  maxFileCount: 5,
  // doc・image は Base64 エンコード後のサイズ、video は生サイズで検証する（MiB 基準）。
  maxFileSizeMB: 4.5,
  // PDF のみ 4.5MB を超えても Bedrock Converse で通るため上限を緩和する。
  maxPdfFileSizeMB: 15,
  maxImageFileCount: 20,
  maxImageFileSizeMB: 4.5,
  maxVideoFileCount: 1,
  maxVideoFileSizeMB: 1000,
} as const;
