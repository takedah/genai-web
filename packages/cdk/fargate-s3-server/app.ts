import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import compression from 'compression';
import express, { NextFunction, Request, Response } from 'express';
import { Readable } from 'stream';

export const app = express();
const port = 8080;

const BUCKET = process.env.BUCKET_NAME || '';

export const s3Client = new S3Client({});

// 上流（源内 Web）が CloudFront の ResponseHeadersPolicy で付与していたセキュリティヘッダの移植
const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.amazonaws.com wss://*.amazonaws.com https://*.amazoncognito.com; font-src 'self' https://fonts.gstatic.com data:; object-src 'none'; frame-ancestors 'none';";

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.set({
    'Content-Security-Policy': CSP,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  next();
});

app.use(compression());

app.get('/healthcheck', (_req: Request, res: Response) => {
  res.status(200).send();
});

const cacheControlFor = (key: string): string => {
  // Vite のビルド成果物（assets/ 以下）はファイル名にコンテンツハッシュを含むため長期キャッシュ可能
  if (key.startsWith('assets/')) {
    return 'public, max-age=31536000, immutable';
  }

  // index.html がキャッシュされると、デプロイ後も古いアセット参照が残り画面が壊れるため保存させない
  if (key === 'index.html') {
    return 'no-store';
  }

  return 'no-cache';
};

const httpStatusOf = (err: unknown): number | undefined =>
  typeof err === 'object' && err !== null && '$metadata' in err
    ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    : undefined;

const isNotFound = (err: unknown): boolean =>
  (err instanceof Error && err.name === 'NoSuchKey') || httpStatusOf(err) === 404;

const isNotModified = (err: unknown): boolean => httpStatusOf(err) === 304;

const streamS3Object = async (
  res: Response,
  key: string,
  ifNoneMatch?: string,
): Promise<void> => {
  const { Body, ContentType, ContentLength, ETag, LastModified } = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      IfNoneMatch: ifNoneMatch,
    }),
  );

  if (!Body) {
    throw new Error(`S3 object body is empty: ${key}`);
  }

  res.set('Content-Type', ContentType || 'application/octet-stream');
  res.set('Cache-Control', cacheControlFor(key));

  if (ETag) {
    res.set('ETag', ETag);
  }

  if (LastModified) {
    res.set('Last-Modified', LastModified.toUTCString());
  }

  if (ContentLength !== undefined) {
    res.set('Content-Length', ContentLength.toString());
  }

  const readableBody = Body as Readable;
  readableBody.on('error', (err) => {
    console.error(`Failed to stream ${key}`, err);
    res.destroy(err);
  });
  readableBody.pipe(res);
};

app.get('{*key}', async (req: Request, res: Response) => {
  // メンテナンスモード中は全リクエストに maintenance.html を返す
  // （maintenance.html はフロントエンドのデプロイ時に S3 へコピーされる）
  if (process.env.MAINTENANCE === 'true') {
    res.status(503);
    res.set('Cache-Control', 'no-store');

    try {
      const { Body } = await s3Client.send(
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: 'maintenance.html',
        }),
      );

      if (!Body) {
        throw new Error('maintenance.html body is empty');
      }

      res.set('Content-Type', 'text/html');
      (Body as Readable).pipe(res);
    } catch (err) {
      console.error('Failed to fetch maintenance.html', err);
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.send('メンテナンス中です。しばらくお待ちください。');
    }
    return;
  }

  let key = req.path.replace(/^\/+/, '');

  if (!key) {
    key = 'index.html';
  }

  try {
    await streamS3Object(res, key, req.headers['if-none-match']);
  } catch (err) {
    if (isNotModified(err)) {
      res.status(304).end();
      return;
    }

    if (isNotFound(err)) {
      // 拡張子を持つパス（JS/CSS/画像など）の 404 を index.html で隠すと
      // 障害の切り分けができなくなるため、素直に 404 を返す
      if (/\.[^/]+$/.test(key)) {
        res.status(404).send('Not Found');
        return;
      }

      // 拡張子のないパスは SPA のルーティング（例: /chat/xxx）とみなして index.html を返す
      try {
        await streamS3Object(res, 'index.html');
      } catch (indexErr) {
        console.error('Failed to fetch index.html', indexErr);
        res.status(500).send('Internal Server Error');
      }
      return;
    }

    // 404 以外のエラー（権限・スロットリング等）は index.html で隠さずエラーとして返す
    console.error(`Failed to fetch ${key}`, err);
    res.status(500).send('Internal Server Error');
  }
});

// テスト時は import されるだけでリッスンしない（require.main は esbuild の CJS バンドルで有効）
if (typeof require !== 'undefined' && require.main === module) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Start listening on http://0.0.0.0:${port}...`);
  });

  // ECS のタスク停止（SIGTERM）時に新規接続の受付を止め、処理中のリクエスト完了を待って終了する
  process.on('SIGTERM', () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
