import { describe, expect, test } from 'vitest';
import { FileRetrievalError, parseS3Uri } from '../../../lambda/utils/s3Uri';

describe('parseS3Uri', () => {
  test('s3://bucket/key 形式を bucket と key に分解する', () => {
    const result = parseS3Uri('s3://my-bucket/ap-northeast-1:abc/uuid/report.pdf');
    expect(result).toEqual({
      bucket: 'my-bucket',
      encodedKey: 'ap-northeast-1:abc/uuid/report.pdf',
      key: 'ap-northeast-1:abc/uuid/report.pdf',
    });
  });

  test('key の URL エンコード文字を decodeURIComponent で復号する', () => {
    const result = parseS3Uri('s3://my-bucket/id/uuid/%E5%A0%B1%E5%91%8A%20v2.pdf');
    expect(result?.key).toBe('id/uuid/報告 v2.pdf');
    // encodedKey はエンコードされたまま保持される
    expect(result?.encodedKey).toBe('id/uuid/%E5%A0%B1%E5%91%8A%20v2.pdf');
  });

  test('s3:// 以外のスキームは undefined', () => {
    expect(parseS3Uri('https://example.com/foo')).toBeUndefined();
    expect(parseS3Uri('my-bucket/key')).toBeUndefined();
  });

  test('key が無い場合は undefined', () => {
    expect(parseS3Uri('s3://my-bucket/')).toBeUndefined();
    expect(parseS3Uri('s3://my-bucket')).toBeUndefined();
  });

  test('不正な URL エンコード（孤立した %）は undefined', () => {
    expect(parseS3Uri('s3://my-bucket/id/%')).toBeUndefined();
  });

  test('先頭スラッシュの key（空オーナーセグメント）はそのまま保持する（認可は後段で弾く）', () => {
    // s3://bucket//id/... のように key が / で始まると先頭セグメントが空になる。
    // パースは成功するが、後段の authorizeOwnedKey が空オーナーを弾くことで守られる。
    const result = parseS3Uri('s3://my-bucket//id/uuid/file.pdf');
    expect(result?.key).toBe('/id/uuid/file.pdf');
  });

  test('path traversal 風（../）の key もリテラルに保持する（S3 は .. を特別扱いしない）', () => {
    const result = parseS3Uri('s3://my-bucket/../other-user/file.pdf');
    expect(result?.key).toBe('../other-user/file.pdf');
  });

  test('改行・制御文字を含む key はデコードして保持する（CRLF はヘッダ注入に至らない）', () => {
    const result = parseS3Uri('s3://my-bucket/id/%0d%0aevil.pdf');
    expect(result?.key).toBe('id/\r\nevil.pdf');
  });

  test('改行を含む URI 全体は $ アンカーにより末尾以外の行をマッチさせない', () => {
    // 攻撃者が複数行を仕込んでも、改行入りはマッチ全体が成立せず undefined。
    expect(parseS3Uri('s3://my-bucket/legit-key\nsecret-line')).toBeUndefined();
  });

  test('長大な key でも線形時間で処理される（ReDoS 回帰）', () => {
    const longUri = `s3://my-bucket/${'a'.repeat(200000)}`;
    const start = performance.now();
    const result = parseS3Uri(longUri);
    const elapsedMs = performance.now() - start;
    expect(result?.bucket).toBe('my-bucket');
    // バックトラック爆発が無いことの目安。十分に余裕を持たせた閾値。
    expect(elapsedMs).toBeLessThan(100);
  });
});

describe('FileRetrievalError', () => {
  test('name が FileRetrievalError で instanceof が成立する', () => {
    const err = new FileRetrievalError('test');
    expect(err).toBeInstanceOf(FileRetrievalError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('FileRetrievalError');
    expect(err.message).toBe('test');
  });
});
