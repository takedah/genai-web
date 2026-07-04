import { once } from 'events';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { Readable } from 'stream';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { app, s3Client } from '../fargate-s3-server/app';

const s3Object = (content: string, contentType: string, etag?: string) => ({
  Body: Readable.from(Buffer.from(content)),
  ContentType: contentType,
  ETag: etag,
});

const notFoundError = () =>
  Object.assign(new Error('NoSuchKey'), {
    name: 'NoSuchKey',
    $metadata: { httpStatusCode: 404 },
  });

// GetObjectCommand の入力（Key / IfNoneMatch）に応じた応答を差し込む
const mockS3 = (impl: (input: { Key?: string; IfNoneMatch?: string }) => unknown) => {
  vi.spyOn(s3Client, 'send').mockImplementation(
    // biome-ignore lint/suspicious/noExplicitAny: SDK の send のオーバーロード型を単純化するため
    (async (cmd: any) => impl(cmd.input ?? {})) as any,
  );
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.MAINTENANCE;
});

describe('fargate-s3-server', () => {
  test('healthcheck は S3 に触らず 200 を返す', async () => {
    const res = await fetch(`${baseUrl}/healthcheck`);
    expect(res.status).toBe(200);
  });

  test('全レスポンスにセキュリティヘッダが付与される', async () => {
    const res = await fetch(`${baseUrl}/healthcheck`);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('strict-transport-security')).toContain('max-age=63072000');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  test('ハッシュ付きアセットは長期キャッシュ + ETag 付きで返す', async () => {
    mockS3(() => s3Object('console.log(1);', 'application/javascript', '"etag1"'));

    const res = await fetch(`${baseUrl}/assets/index-abc123.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('content-type')).toContain('application/javascript');
    expect(res.headers.get('etag')).toBe('"etag1"');
    expect(await res.text()).toBe('console.log(1);');
  });

  test('ルートパスは index.html を no-store で返す', async () => {
    mockS3((input) => {
      expect(input.Key).toBe('index.html');
      return s3Object('<html>app</html>', 'text/html');
    });

    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('<html>app</html>');
  });

  test('拡張子のないパスは SPA ルーティングとして index.html にフォールバックする', async () => {
    mockS3((input) => {
      if (input.Key === 'index.html') {
        return s3Object('<html>app</html>', 'text/html');
      }
      throw notFoundError();
    });

    const res = await fetch(`${baseUrl}/chat/12345`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('<html>app</html>');
  });

  test('存在しないアセット（拡張子付き）は index.html で隠さず 404 を返す', async () => {
    mockS3(() => {
      throw notFoundError();
    });

    const res = await fetch(`${baseUrl}/assets/missing.js`);
    expect(res.status).toBe(404);
  });

  test('If-None-Match が一致する場合は 304 を返す', async () => {
    mockS3((input) => {
      if (input.IfNoneMatch === '"etag1"') {
        throw Object.assign(new Error('NotModified'), {
          $metadata: { httpStatusCode: 304 },
        });
      }
      return s3Object('body', 'text/plain');
    });

    const res = await fetch(`${baseUrl}/assets/index-abc123.js`, {
      headers: { 'If-None-Match': '"etag1"' },
    });
    expect(res.status).toBe(304);
  });

  test('404 以外の S3 エラーは index.html で隠さず 500 を返す', async () => {
    mockS3(() => {
      throw Object.assign(new Error('AccessDenied'), {
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      });
    });

    const res = await fetch(`${baseUrl}/chat/12345`);
    expect(res.status).toBe(500);
  });

  test('メンテナンスモード中は maintenance.html を 503 で返す', async () => {
    process.env.MAINTENANCE = 'true';
    mockS3((input) => {
      expect(input.Key).toBe('maintenance.html');
      return s3Object('<html>メンテナンス中</html>', 'text/html');
    });

    const res = await fetch(`${baseUrl}/chat/12345`);
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('<html>メンテナンス中</html>');
  });

  test('メンテナンスモード中に maintenance.html が取得できなくても 503 を返す', async () => {
    process.env.MAINTENANCE = 'true';
    mockS3(() => {
      throw notFoundError();
    });

    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('メンテナンス中');
  });
});
