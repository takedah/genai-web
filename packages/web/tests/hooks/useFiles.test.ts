import { act, renderHook, waitFor } from '@testing-library/react';
import type { FileLimit } from 'genai-web';
import { afterEach, describe, expect, it, vi } from 'vitest';

// fileApi はネットワークアクセスを伴うためモックする
vi.mock('@/lib/fileApi', () => ({
  getSignedUrl: vi.fn(() => new Promise(() => {})), // アップロードは解決させない（検証のみ対象）
  uploadFile: vi.fn(() => Promise.resolve()),
  deleteUploadedFile: vi.fn(() => Promise.resolve()),
  getFileDownloadSignedUrl: vi.fn(() => Promise.resolve('https://example.com/file')),
  getS3Uri: vi.fn((url: string) => url),
}));

// MIME スプーフィング検出は本テストの対象外。常に undefined（拡張子どおり）を返す
vi.mock('file-type', () => ({
  fileTypeFromStream: vi.fn(async () => undefined),
  fileTypeFromBuffer: vi.fn(async () => undefined),
}));

const MiB = 1024 * 1024;

const FILE_LIMIT: FileLimit = {
  accept: {
    doc: ['.pdf', '.txt'],
    image: ['.png', '.jpg'],
    video: ['.mp4'],
  },
  maxFileCount: 5,
  maxFileSizeMB: 4.5,
  maxImageFileCount: 20,
  maxImageFileSizeMB: 4.5,
  maxVideoFileCount: 1,
  maxVideoFileSizeMB: 1000,
};

const accept = [...FILE_LIMIT.accept.doc, ...FILE_LIMIT.accept.image, ...FILE_LIMIT.accept.video];

// doc/image は生サイズから Base64 後サイズ（4 * ceil(n/3)）を算出して検証する。
// 上限 4.5MiB = 4,718,592 バイトちょうどになる生サイズは 3 * (4,718,592 / 4) = 3,538,944。
const BASE64_LIMIT_BYTES = 4.5 * MiB;
const RAW_SIZE_AT_LIMIT = (BASE64_LIMIT_BYTES / 4) * 3;

// File.size は読み取り専用のため、生サイズを直接指定して検証ロジックを対象にする。
const createFile = (name: string, type: string, rawSizeBytes: number): File => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: rawSizeBytes });
  return file;
};

// UTF-8 検証は file.arrayBuffer() の中身を読むため、バイト列を明示して File を作る。
// jsdom 差異を避けるため arrayBuffer() を指定バイト列で固定する。
// rawSizeBytes を指定するとサイズ検証のための file.size を上書きする。
const createFileWithBytes = (
  name: string,
  type: string,
  bytes: number[],
  rawSizeBytes?: number,
): File => {
  const buffer = new Uint8Array(bytes).buffer;
  const file = new File([buffer], name, { type });
  // vi.spyOn できるよう configurable にする（全バイト読み込みのスキップ検証で必要）。
  Object.defineProperty(file, 'arrayBuffer', { value: async () => buffer, configurable: true });
  // jsdom の File.stream() は throw するため、MIME spoof 検知（fileTypeFromStream 経由）が
  // catch に落ちて arrayBuffer を呼んでしまう。UTF-8 パスの arrayBuffer 呼び出しを分離して
  // 検証できるよう、throw しない stream() を与える（fileTypeFromStream はモックで引数を無視）。
  Object.defineProperty(file, 'stream', { value: () => new ReadableStream(), configurable: true });
  if (rawSizeBytes !== undefined) {
    Object.defineProperty(file, 'size', { value: rawSizeBytes });
  }
  return file;
};

const importUseFiles = async () => {
  vi.resetModules();
  return (await import('@/hooks/useFiles')).useFiles;
};

const sizeErrorOf = (name: string) => `${name} は最大ファイルサイズ`;

describe('useFiles - validateUploadedFiles (Base64 後サイズ検証)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('doc は Base64 後サイズが上限ちょうどなら許可される', async () => {
    const useFiles = await importUseFiles();
    const { result } = renderHook(() => useFiles('/chat'));

    const file = createFile('exact.pdf', 'application/pdf', RAW_SIZE_AT_LIMIT);
    await act(async () => {
      await result.current.uploadFiles([file], FILE_LIMIT, accept);
    });

    await waitFor(() => {
      expect(result.current.errorMessages.some((m) => m.includes(sizeErrorOf('exact.pdf')))).toBe(
        false,
      );
    });
  });

  it('doc は Base64 後サイズが上限を 1 バイト超えるとエラー', async () => {
    const useFiles = await importUseFiles();
    const { result } = renderHook(() => useFiles('/chat'));

    const file = createFile('over.pdf', 'application/pdf', RAW_SIZE_AT_LIMIT + 1);
    await act(async () => {
      await result.current.uploadFiles([file], FILE_LIMIT, accept);
    });

    await waitFor(() => {
      expect(result.current.errorMessages.some((m) => m.includes(sizeErrorOf('over.pdf')))).toBe(
        true,
      );
    });
  });

  it('image も Base64 後 4.5MiB で判定される', async () => {
    const useFiles = await importUseFiles();
    const { result } = renderHook(() => useFiles('/chat'));

    const ok = createFile('ok.png', 'image/png', RAW_SIZE_AT_LIMIT);
    const ng = createFile('ng.png', 'image/png', RAW_SIZE_AT_LIMIT + 1);
    await act(async () => {
      await result.current.uploadFiles([ok, ng], FILE_LIMIT, accept);
    });

    await waitFor(() => {
      expect(result.current.errorMessages.some((m) => m.includes(sizeErrorOf('ok.png')))).toBe(
        false,
      );
      expect(result.current.errorMessages.some((m) => m.includes(sizeErrorOf('ng.png')))).toBe(
        true,
      );
    });
  });

  it('大文字拡張子も許可される（拡張子は大小区別しない）', async () => {
    const useFiles = await importUseFiles();
    const { result } = renderHook(() => useFiles('/chat'));

    const file = createFile('UPPER.PDF', 'application/pdf', 1024);
    await act(async () => {
      await result.current.uploadFiles([file], FILE_LIMIT, accept);
    });

    await waitFor(() => {
      expect(result.current.errorMessages.some((m) => m.includes('許可されていない拡張子'))).toBe(
        false,
      );
    });
  });

  it('video は Base64 ではなく生サイズ（10進 MB 基準）で検証される', async () => {
    const useFiles = await importUseFiles();
    const { result } = renderHook(() => useFiles('/chat'));

    // 上限 1000MB = 1,000,000,000 バイト。生サイズが上限内なら許可される
    const file = createFile('movie.mp4', 'video/mp4', 500 * 1e6);
    await act(async () => {
      await result.current.uploadFiles([file], FILE_LIMIT, accept);
    });

    await waitFor(() => {
      expect(result.current.errorMessages.some((m) => m.includes(sizeErrorOf('movie.mp4')))).toBe(
        false,
      );
    });
  });

  it('video は生サイズが 10進 MB 基準の上限を超えるとエラー', async () => {
    const useFiles = await importUseFiles();
    const { result } = renderHook(() => useFiles('/chat'));

    const file = createFile('big.mp4', 'video/mp4', 1000 * 1e6 + 1);
    await act(async () => {
      await result.current.uploadFiles([file], FILE_LIMIT, accept);
    });

    await waitFor(() => {
      expect(result.current.errorMessages.some((m) => m.includes(sizeErrorOf('big.mp4')))).toBe(
        true,
      );
    });
  });
});

describe('useFiles - validateUploadedFiles (UTF-8 検証)', () => {
  const UTF8_ERROR =
    'ファイルの形式が UTF-8 形式ではありません。 UTF-8 形式に変換後、再度お試しください。';

  // テキスト系を許可する FILE_LIMIT。それ以外は既存と同じ。
  const TEXT_FILE_LIMIT: FileLimit = {
    ...FILE_LIMIT,
    accept: {
      doc: ['.pdf', '.txt', '.csv', '.md', '.html'],
      image: ['.png', '.jpg'],
      video: ['.mp4'],
    },
  };
  const textAccept = [
    ...TEXT_FILE_LIMIT.accept.doc,
    ...TEXT_FILE_LIMIT.accept.image,
    ...TEXT_FILE_LIMIT.accept.video,
  ];

  // Shift-JIS の「デジタル庁」。UTF-8 として不正なバイト列。
  const SHIFT_JIS_BYTES = [0x83, 0x66, 0x83, 0x57, 0x83, 0x5e, 0x83, 0x8b, 0x92, 0xa1];
  // UTF-8 の「デジタル庁」。
  const UTF8_BYTES = [
    0xe3, 0x83, 0x87, 0xe3, 0x82, 0xb8, 0xe3, 0x82, 0xbf, 0xe3, 0x83, 0xab, 0xe5, 0xba, 0x81,
  ];
  // BOM 付き UTF-8。
  const UTF8_BOM_BYTES = [0xef, 0xbb, 0xbf, ...UTF8_BYTES];
  // ASCII のみ（"a,b,c"）。
  const ASCII_BYTES = [0x61, 0x2c, 0x62, 0x2c, 0x63];

  afterEach(() => {
    vi.clearAllMocks();
  });

  const uploadAndGetErrors = async (file: File, acceptList: string[] = textAccept) => {
    const useFiles = await importUseFiles();
    const { result } = renderHook(() => useFiles('/chat'));
    await act(async () => {
      await result.current.uploadFiles([file], TEXT_FILE_LIMIT, acceptList);
    });
    return result;
  };

  it('Shift-JIS の CSV は UTF-8 エラーになる', async () => {
    const file = createFileWithBytes('shift_jis.csv', 'text/csv', SHIFT_JIS_BYTES);
    // サイズ内のテキスト系は UTF-8 判定のため arrayBuffer を読む（スキップ最適化の対の検証）。
    const arrayBufferSpy = vi.spyOn(file, 'arrayBuffer');
    const result = await uploadAndGetErrors(file);

    await waitFor(() => {
      expect(result.current.errorMessages).toContain(UTF8_ERROR);
    });
    expect(arrayBufferSpy).toHaveBeenCalled();
  });

  it('UTF-8 の CSV はエラーにならない', async () => {
    const file = createFileWithBytes('utf8.csv', 'text/csv', UTF8_BYTES);
    const result = await uploadAndGetErrors(file);

    await waitFor(() => {
      expect(result.current.errorMessages).not.toContain(UTF8_ERROR);
    });
  });

  it('BOM 付き UTF-8 はエラーにならない', async () => {
    const file = createFileWithBytes('bom.txt', 'text/plain', UTF8_BOM_BYTES);
    const result = await uploadAndGetErrors(file);

    await waitFor(() => {
      expect(result.current.errorMessages).not.toContain(UTF8_ERROR);
    });
  });

  it('ASCII のみのファイルはエラーにならない', async () => {
    const file = createFileWithBytes('ascii.md', 'text/markdown', ASCII_BYTES);
    const result = await uploadAndGetErrors(file);

    await waitFor(() => {
      expect(result.current.errorMessages).not.toContain(UTF8_ERROR);
    });
  });

  it('空ファイルはエラーにならない', async () => {
    const file = createFileWithBytes('empty.txt', 'text/plain', []);
    const result = await uploadAndGetErrors(file);

    await waitFor(() => {
      expect(result.current.errorMessages).not.toContain(UTF8_ERROR);
    });
  });

  it('大文字拡張子（.CSV）も UTF-8 検証の対象になる', async () => {
    const file = createFileWithBytes('UPPER.CSV', 'text/csv', SHIFT_JIS_BYTES);
    const result = await uploadAndGetErrors(file);

    await waitFor(() => {
      expect(result.current.errorMessages).toContain(UTF8_ERROR);
    });
  });

  it('対象外拡張子（pdf）は不正バイト列でも UTF-8 エラーにならない', async () => {
    const file = createFileWithBytes('binary.pdf', 'application/pdf', SHIFT_JIS_BYTES);
    const result = await uploadAndGetErrors(file);

    await waitFor(() => {
      expect(result.current.errorMessages).not.toContain(UTF8_ERROR);
    });
  });

  it('サイズ超過のファイルは UTF-8 判定をスキップしサイズエラーのみになる', async () => {
    // file.size を上限超過に上書きし、UTF-8 全バイト読み込みがスキップされることを確認する。
    const overBytes = (FILE_LIMIT.maxFileSizeMB / 4) * 3 * MiB + 1;
    const file = createFileWithBytes('huge.csv', 'text/csv', SHIFT_JIS_BYTES, overBytes);
    // 全バイト読み込みが実際にスキップされること（最適化の回帰検知）を直接アサートする。
    const arrayBufferSpy = vi.spyOn(file, 'arrayBuffer');
    const result = await uploadAndGetErrors(file);

    await waitFor(() => {
      expect(result.current.errorMessages.some((m) => m.includes(sizeErrorOf('huge.csv')))).toBe(
        true,
      );
      expect(result.current.errorMessages).not.toContain(UTF8_ERROR);
    });
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it('許可されていない拡張子は UTF-8 判定をスキップし許可外エラーのみになる', async () => {
    const file = createFileWithBytes('shift_jis.csv', 'text/csv', SHIFT_JIS_BYTES);
    const arrayBufferSpy = vi.spyOn(file, 'arrayBuffer');
    // .csv を許可しない accept。許可外エラーのみで UTF-8 エラーは出さず、読み込みもしない。
    const result = await uploadAndGetErrors(file, ['.pdf']);

    await waitFor(() => {
      expect(result.current.errorMessages.some((m) => m.includes('許可されていない拡張子'))).toBe(
        true,
      );
      expect(result.current.errorMessages).not.toContain(UTF8_ERROR);
    });
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });
});
