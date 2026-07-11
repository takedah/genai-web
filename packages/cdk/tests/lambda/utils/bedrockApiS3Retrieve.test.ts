import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  ConverseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { UnrecordedMessage } from 'genai-web';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import bedrockApi from '../../../lambda/utils/bedrockApi';
import { mockEnvironment } from '../testUtils';

const bedrockMock = mockClient(BedrockRuntimeClient);
const s3Mock = mockClient(S3Client);

// テスト対象は createConverseCommandInput の絞り込み・S3取得・所有者チェック。
// invoke 経由で ConverseCommand に渡る input を捕捉して検証する。
const MODEL = {
  type: 'bedrock' as const,
  modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
};
const BUCKET = 'my-file-bucket';
const IDENTITY = 'ap-northeast-1:owner-1';

const s3Doc = (name: string, identityId = IDENTITY): UnrecordedMessage => ({
  role: 'user',
  content: 'see attached',
  extraData: [
    {
      type: 'file',
      name,
      source: {
        type: 's3',
        mediaType: 'application/pdf',
        data: `s3://${BUCKET}/${identityId}/uuid-${name}/${name}`,
      },
    },
  ],
});

const getSentInput = (): ConverseCommandInput => {
  const calls = bedrockMock.commandCalls(ConverseCommand);
  return calls[calls.length - 1].args[0].input as ConverseCommandInput;
};

const countBlocks = (input: ConverseCommandInput, key: 'document' | 'image' | 'video'): number =>
  (input.messages ?? []).reduce(
    (sum, m) => sum + (m.content ?? []).filter((b) => key in b).length,
    0,
  );

// Converse 入力に含まれる document.name を出現順で取り出す
const documentNames = (input: ConverseCommandInput): string[] =>
  (input.messages ?? [])
    .flatMap((m) => m.content ?? [])
    // biome-ignore lint/suspicious/noExplicitAny: テスト用の型アクセス
    .filter((b) => 'document' in b)
    // biome-ignore lint/suspicious/noExplicitAny: テスト用の型アクセス
    .map((b: any) => b.document.name as string);

// video ブロックを出現順で取り出す
const videoBlocks = (input: ConverseCommandInput) =>
  (input.messages ?? [])
    .flatMap((m) => m.content ?? [])
    .filter((b) => 'video' in b)
    // biome-ignore lint/suspicious/noExplicitAny: テスト用の型アクセス
    .map((b: any) => b.video);

describe('bedrockApi S3 retrieve / latest-N filtering', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    bedrockMock.reset();
    s3Mock.reset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    restoreEnv = mockEnvironment({ MODEL_REGION: 'us-east-1', BUCKET_NAME: BUCKET });
    bedrockMock.on(ConverseCommand).resolves({
      output: { message: { role: 'assistant', content: [{ text: 'ok' }] } },
      stopReason: 'end_turn',
    });
    s3Mock.on(GetObjectCommand).resolves({
      // transformToByteArray を持つスタブ
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      // biome-ignore lint/suspicious/noExplicitAny: テスト用スタブ
    } as any);
  });

  afterEach(() => {
    restoreEnv?.();
    vi.restoreAllMocks();
  });

  test('document が6件あると最新5件のみ Converse に渡る', async () => {
    const messages = Array.from({ length: 6 }, (_, i) => s3Doc(`doc${i}.pdf`));
    await bedrockApi.invoke(MODEL, messages, 'id', IDENTITY);

    const input = getSentInput();
    expect(countBlocks(input, 'document')).toBe(5);
    // 最新（末尾）が残り、最古の doc0 は落ちる
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(5);
  });

  test('document 6件のうち落ちるのは最古の doc0（内容で最新5件保持を確認）', async () => {
    const messages = Array.from({ length: 6 }, (_, i) => s3Doc(`doc${i}.pdf`));
    await bedrockApi.invoke(MODEL, messages, 'id', IDENTITY);

    // 取得された S3 key から、保持されたのが doc1..doc5（doc0 が落ちる）であることを確認
    const fetchedKeys = s3Mock
      .commandCalls(GetObjectCommand)
      .map((c) => c.args[0].input.Key as string);
    expect(fetchedKeys.some((k) => k.includes('doc0.pdf'))).toBe(false);
    for (let i = 1; i <= 5; i++) {
      expect(fetchedKeys.some((k) => k.includes(`doc${i}.pdf`))).toBe(true);
    }
  });

  test('document の name に保持対象を先頭から 0 始まりで採番する（一意・重複なし）', async () => {
    const messages = Array.from({ length: 3 }, (_, i) => s3Doc(`doc${i}.pdf`));
    await bedrockApi.invoke(MODEL, messages, 'id', IDENTITY);

    const names = documentNames(getSentInput());
    expect(names).toHaveLength(3);
    // {safeName}-{index} 形式で末尾連番が 0,1,2 と一意に振られる
    expect(names.map((n) => n.split('-').pop())).toEqual(['0', '1', '2']);
    expect(new Set(names).size).toBe(3);
  });

  test('document がちょうど5件なら全件保持（境界）', async () => {
    const messages = Array.from({ length: 5 }, (_, i) => s3Doc(`doc${i}.pdf`));
    await bedrockApi.invoke(MODEL, messages, 'id', IDENTITY);
    expect(countBlocks(getSentInput(), 'document')).toBe(5);
  });

  test('同一メッセージ内に複数 document があってもファイル単位でカウントする', async () => {
    // 1 メッセージに 6 つの file を入れる（メッセージ数ではなくファイル数で 5 に絞る）
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'many',
      extraData: Array.from({ length: 6 }, (_, i) => ({
        type: 'file' as const,
        name: `d${i}.pdf`,
        source: {
          type: 's3' as const,
          mediaType: 'application/pdf',
          data: `s3://${BUCKET}/${IDENTITY}/uuid-${i}/d${i}.pdf`,
        },
      })),
    };
    await bedrockApi.invoke(MODEL, [msg], 'id', IDENTITY);
    expect(countBlocks(getSentInput(), 'document')).toBe(5);
  });

  test('document と image は独立してカウントされる（doc5 + image20 が共存）', async () => {
    const docs = Array.from({ length: 5 }, (_, i) => s3Doc(`doc${i}.pdf`));
    const imgs: UnrecordedMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: 'user',
      content: 'img',
      extraData: [
        {
          type: 'image',
          name: `img${i}.png`,
          source: {
            type: 's3',
            mediaType: 'image/png',
            data: `s3://${BUCKET}/${IDENTITY}/uuid-img-${i}/img${i}.png`,
          },
        },
      ],
    }));
    await bedrockApi.invoke(MODEL, [...docs, ...imgs], 'id', IDENTITY);

    const input = getSentInput();
    expect(countBlocks(input, 'document')).toBe(5);
    expect(countBlocks(input, 'image')).toBe(20);
  });

  test('video は件数制限の対象外で全件保持される（document 上限とは独立）', async () => {
    // document を上限超過させても video は別枠で全件残る
    const docs = Array.from({ length: 6 }, (_, i) => s3Doc(`doc${i}.pdf`));
    const videos: UnrecordedMessage[] = Array.from({ length: 8 }, (_, i) => ({
      role: 'user',
      content: 'v',
      extraData: [
        {
          type: 'video',
          name: `v${i}.mp4`,
          source: {
            type: 's3',
            mediaType: 'video/mp4',
            data: `s3://${BUCKET}/${IDENTITY}/uuid-v-${i}/v${i}.mp4`,
          },
        },
      ],
    }));
    await bedrockApi.invoke(MODEL, [...docs, ...videos], 'id', IDENTITY);

    const input = getSentInput();
    expect(countBlocks(input, 'document')).toBe(5);
    expect(countBlocks(input, 'video')).toBe(8);
  });

  test('video の s3 ソースは GetObject せず s3Location 直渡しになる', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'v',
      extraData: [
        {
          type: 'video',
          name: 'movie.mp4',
          source: {
            type: 's3',
            mediaType: 'video/mp4',
            data: `s3://${BUCKET}/${IDENTITY}/uuid-v/movie.mp4`,
          },
        },
      ],
    };
    await bedrockApi.invoke(MODEL, [msg], 'id', IDENTITY);

    // video は Lambda で取得せず Bedrock に S3 URI を直接渡す
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
    const videos = videoBlocks(getSentInput());
    expect(videos).toHaveLength(1);
    expect(videos[0].source.s3Location.uri).toBe(`s3://${BUCKET}/${IDENTITY}/uuid-v/movie.mp4`);
    expect(videos[0].source.bytes).toBeUndefined();
  });

  test('video の base64 ソースは bytes に変換される（s3Location ではない）', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'v',
      extraData: [
        {
          type: 'video',
          name: 'movie.mp4',
          source: {
            type: 'base64',
            mediaType: 'video/mp4',
            data: Buffer.from('hello').toString('base64'),
          },
        },
      ],
    };
    await bedrockApi.invoke(MODEL, [msg], 'id', undefined);

    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
    const videos = videoBlocks(getSentInput());
    expect(videos).toHaveLength(1);
    expect(videos[0].source.bytes).toBeDefined();
    expect(videos[0].source.s3Location).toBeUndefined();
  });

  test('base64 と s3 の document が混在しても両方正しく bytes 化される', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'mix',
      extraData: [
        {
          type: 'file',
          name: 's3doc.pdf',
          source: {
            type: 's3',
            mediaType: 'application/pdf',
            data: `s3://${BUCKET}/${IDENTITY}/uuid-s3/s3doc.pdf`,
          },
        },
        {
          type: 'file',
          name: 'b64doc.pdf',
          source: {
            type: 'base64',
            mediaType: 'application/pdf',
            data: Buffer.from('local').toString('base64'),
          },
        },
      ],
    };
    await bedrockApi.invoke(MODEL, [msg], 'id', IDENTITY);

    // s3 側だけ GetObject され、base64 側は取得しない。どちらも document として渡る。
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(1);
    expect(countBlocks(getSentInput(), 'document')).toBe(2);
  });

  test('s3 ソースは GetObject で取得され bytes として渡る', async () => {
    await bedrockApi.invoke(MODEL, [s3Doc('a.pdf')], 'id', IDENTITY);

    const getCalls = s3Mock.commandCalls(GetObjectCommand);
    expect(getCalls.length).toBe(1);
    expect(getCalls[0].args[0].input).toMatchObject({
      Bucket: BUCKET,
      Key: `${IDENTITY}/uuid-a.pdf/a.pdf`,
    });
    const input = getSentInput();
    expect(countBlocks(input, 'document')).toBe(1);
  });

  test('bucket 名が不一致だとエラー（GetObject されない）', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'x',
      extraData: [
        {
          type: 'file',
          name: 'a.pdf',
          source: { type: 's3', mediaType: 'application/pdf', data: 's3://other-bucket/k/u/a.pdf' },
        },
      ],
    };
    await expect(bedrockApi.invoke(MODEL, [msg], 'id', IDENTITY)).rejects.toThrow();
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
  });

  test('他人の identityId を含む key は弾く（所有者チェック）', async () => {
    const msg = s3Doc('a.pdf', 'ap-northeast-1:another-user');
    await expect(bedrockApi.invoke(MODEL, [msg], 'id', IDENTITY)).rejects.toThrow();
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
  });

  test('identityId 未指定で s3 ソースがあるとエラー（deny by default）', async () => {
    await expect(bedrockApi.invoke(MODEL, [s3Doc('a.pdf')], 'id', undefined)).rejects.toThrow();
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
  });

  test('先頭スラッシュで空オーナーになる key は弾く（パースは通るが認可で拒否）', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'x',
      extraData: [
        {
          type: 'file',
          name: 'a.pdf',
          source: { type: 's3', mediaType: 'application/pdf', data: `s3://${BUCKET}//uuid/a.pdf` },
        },
      ],
    };
    await expect(bedrockApi.invoke(MODEL, [msg], 'id', IDENTITY)).rejects.toThrow();
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
  });

  test('../ で始まる traversal 風 key は弾く（先頭セグメントが identityId と不一致）', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'x',
      extraData: [
        {
          type: 'file',
          name: 'a.pdf',
          source: {
            type: 's3',
            mediaType: 'application/pdf',
            data: `s3://${BUCKET}/../${IDENTITY}/uuid/a.pdf`,
          },
        },
      ],
    };
    await expect(bedrockApi.invoke(MODEL, [msg], 'id', IDENTITY)).rejects.toThrow();
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
  });

  test('正規キーと不正キーが混在すると全体が失敗する（fail-closed・部分通過しない）', async () => {
    // 1メッセージに自分の正規キー + 他人キーが混在。直列取得で不正キーに当たった時点で
    // リクエスト全体が throw され、ConverseCommand には到達しない（部分的に通さない）。
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'x',
      extraData: [
        {
          type: 'file',
          name: 'mine.pdf',
          source: {
            type: 's3',
            mediaType: 'application/pdf',
            data: `s3://${BUCKET}/${IDENTITY}/uuid-mine/mine.pdf`,
          },
        },
        {
          type: 'file',
          name: 'theirs.pdf',
          source: {
            type: 's3',
            mediaType: 'application/pdf',
            data: `s3://${BUCKET}/ap-northeast-1:another-user/uuid-x/theirs.pdf`,
          },
        },
      ],
    };
    await expect(bedrockApi.invoke(MODEL, [msg], 'id', IDENTITY)).rejects.toThrow();
    // ConverseCommand（推論本体）には到達しない＝正規分だけ通すことはない
    expect(bedrockMock.commandCalls(ConverseCommand).length).toBe(0);
  });

  test('別メッセージに不正キーがあっても会話全体が失敗する（fail-closed）', async () => {
    const ok = s3Doc('ok.pdf');
    const bad = s3Doc('bad.pdf', 'ap-northeast-1:another-user');
    await expect(bedrockApi.invoke(MODEL, [ok, bad], 'id', IDENTITY)).rejects.toThrow();
    expect(bedrockMock.commandCalls(ConverseCommand).length).toBe(0);
  });

  test('identityId が空文字でも s3 ソースは弾く（deny by default・undefined と同じ扱い）', async () => {
    await expect(bedrockApi.invoke(MODEL, [s3Doc('a.pdf')], 'id', '')).rejects.toThrow();
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
  });

  test('identityId が空白のみでも s3 ソースは弾く（trim して空はなりすまし防止）', async () => {
    // 空白を先頭セグメントに持つ key と一致させる「空白なりすまし」を防ぐ
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'x',
      extraData: [
        {
          type: 'file',
          name: 'a.pdf',
          source: { type: 's3', mediaType: 'application/pdf', data: `s3://${BUCKET}/ /uuid/a.pdf` },
        },
      ],
    };
    await expect(bedrockApi.invoke(MODEL, [msg], 'id', ' ')).rejects.toThrow();
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
  });

  test('image が21件あると最新20件のみ Converse に渡る', async () => {
    const messages: UnrecordedMessage[] = Array.from({ length: 21 }, (_, i) => ({
      role: 'user',
      content: 'img',
      extraData: [
        {
          type: 'image',
          name: `img${i}.png`,
          source: {
            type: 's3',
            mediaType: 'image/png',
            data: `s3://${BUCKET}/${IDENTITY}/uuid-${i}/img${i}.png`,
          },
        },
      ],
    }));
    await bedrockApi.invoke(MODEL, messages, 'id', IDENTITY);
    expect(countBlocks(getSentInput(), 'image')).toBe(20);
  });

  test('大文字拡張子の document は format が小文字化される', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'x',
      extraData: [
        {
          type: 'file',
          name: 'REPORT.PDF',
          source: {
            type: 's3',
            mediaType: 'application/pdf',
            data: `s3://${BUCKET}/${IDENTITY}/uuid/REPORT.PDF`,
          },
        },
      ],
    };
    await bedrockApi.invoke(MODEL, [msg], 'id', IDENTITY);

    const input = getSentInput();
    const docBlock = (input.messages ?? [])
      .flatMap((m) => m.content ?? [])
      .find((b) => 'document' in b);
    // biome-ignore lint/suspicious/noExplicitAny: テスト用の型アクセス
    expect((docBlock as any).document.format).toBe('pdf');
  });

  test('base64 ソースは S3 取得せず従来どおり渡る', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'x',
      extraData: [
        {
          type: 'file',
          name: 'a.pdf',
          source: {
            type: 'base64',
            mediaType: 'application/pdf',
            data: Buffer.from('hello').toString('base64'),
          },
        },
      ],
    };
    await bedrockApi.invoke(MODEL, [msg], 'id', undefined);
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
    expect(countBlocks(getSentInput(), 'document')).toBe(1);
  });
});

// 本番の /chat は invokeStream（streaming）経路を通る。invoke（同期）と違い、
// S3 取得・認可の失敗は throw されず catch されてユーザー向けメッセージに変換される。
// ここでは「内部情報（bucket 名・key・SDK 例外文字列）を漏らさず汎用メッセージになる」
// という情報漏えい防止の核心を検証する。
describe('bedrockApi invokeStream / S3 失敗時の情報漏えい防止', () => {
  let restoreEnv: () => void;

  const collectText = async (gen: AsyncGenerator<string, void, unknown>): Promise<string> => {
    let text = '';
    for await (const c of gen) {
      const parsed = JSON.parse(c.replace(/\n$/, '')) as { text?: string };
      text += parsed.text ?? '';
    }
    return text;
  };

  const buildStream = (events: unknown[]) => ({
    stream: (async function* () {
      for (const e of events) {
        yield e;
      }
    })(),
  });

  const GENERIC_MESSAGE = '添付ファイルの読み込みに失敗しました。ファイルを再度添付してお試しください。';

  beforeEach(() => {
    bedrockMock.reset();
    s3Mock.reset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    restoreEnv = mockEnvironment({ MODEL_REGION: 'us-east-1', BUCKET_NAME: BUCKET });
    bedrockMock
      .on(ConverseStreamCommand)
      .resolves(buildStream([{ messageStop: { stopReason: 'end_turn' } }]));
  });

  afterEach(() => {
    restoreEnv?.();
    vi.restoreAllMocks();
  });

  test('GetObject が NoSuchKey で失敗すると汎用メッセージのみ流れ、内部情報を漏らさない', async () => {
    const secretKey = `${IDENTITY}/uuid-a.pdf/a.pdf`;
    // NoSuchKey 風の SDK 例外を投げさせる。message に内部 key/bucket を含める。
    s3Mock.on(GetObjectCommand).rejects(
      Object.assign(new Error(`NoSuchKey: The specified key ${secretKey} in ${BUCKET}`), {
        name: 'NoSuchKey',
      }),
    );

    const text = await collectText(bedrockApi.invokeStream(MODEL, [s3Doc('a.pdf')], 'id', IDENTITY));

    expect(text).toContain(GENERIC_MESSAGE);
    // 内部 bucket 名・key・SDK 例外名がユーザー向けに漏れない
    expect(text).not.toContain(BUCKET);
    expect(text).not.toContain(secretKey);
    expect(text).not.toContain('NoSuchKey');
    // ConverseStream には到達しない（取得失敗で打ち切られる）
    expect(bedrockMock.commandCalls(ConverseStreamCommand).length).toBe(0);
  });

  test('他人の identityId を含む key は汎用メッセージで弾かれ、ConverseStream に到達しない', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      // biome-ignore lint/suspicious/noExplicitAny: テスト用スタブ
    } as any);
    const msg = s3Doc('a.pdf', 'ap-northeast-1:another-user');

    const text = await collectText(bedrockApi.invokeStream(MODEL, [msg], 'id', IDENTITY));

    expect(text).toContain(GENERIC_MESSAGE);
    expect(text).not.toContain('another-user');
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
    expect(bedrockMock.commandCalls(ConverseStreamCommand).length).toBe(0);
  });

  test('bucket 名不一致も汎用メッセージで弾かれ、GetObject に到達しない', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'x',
      extraData: [
        {
          type: 'file',
          name: 'a.pdf',
          source: {
            type: 's3',
            mediaType: 'application/pdf',
            data: 's3://attacker-bucket/k/u/a.pdf',
          },
        },
      ],
    };

    const text = await collectText(bedrockApi.invokeStream(MODEL, [msg], 'id', IDENTITY));

    expect(text).toContain(GENERIC_MESSAGE);
    expect(text).not.toContain('attacker-bucket');
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
  });

  test('identityId 未指定で s3 ソースがあると汎用メッセージで弾く（deny by default）', async () => {
    const text = await collectText(
      bedrockApi.invokeStream(MODEL, [s3Doc('a.pdf')], 'id', undefined),
    );

    expect(text).toContain(GENERIC_MESSAGE);
    expect(s3Mock.commandCalls(GetObjectCommand).length).toBe(0);
    expect(bedrockMock.commandCalls(ConverseStreamCommand).length).toBe(0);
  });
});

// 添付ドキュメント + cachePoint の同居で Bedrock が ValidationException
// (content.N.type: Field required) を返す問題の回帰防止。
// cachePoint 対応モデル(Opus 4.8) かつ chat id (/chat) でのみ cachePoint が付く。
describe('bedrockApi 添付メッセージへの cachePoint 付与抑止', () => {
  let restoreEnv: () => void;
  const CACHE_MODEL = { type: 'bedrock' as const, modelId: 'jp.anthropic.claude-opus-4-8' };

  const hasCachePoint = (input: ConverseCommandInput): boolean =>
    (input.messages ?? []).some((m) => (m.content ?? []).some((b) => 'cachePoint' in b));

  beforeEach(() => {
    bedrockMock.reset();
    s3Mock.reset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    restoreEnv = mockEnvironment({ MODEL_REGION: 'us-east-1', BUCKET_NAME: BUCKET });
    bedrockMock.on(ConverseCommand).resolves({
      output: { message: { role: 'assistant', content: [{ text: 'ok' }] } },
      stopReason: 'end_turn',
    });
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      // biome-ignore lint/suspicious/noExplicitAny: テスト用スタブ
    } as any);
  });

  afterEach(() => {
    restoreEnv?.();
    vi.restoreAllMocks();
  });

  test('テキストのみの最新 user メッセージには cachePoint が付く', async () => {
    const messages: UnrecordedMessage[] = [{ role: 'user', content: 'hello' }];
    await bedrockApi.invoke(CACHE_MODEL, messages, '/chat', IDENTITY);
    expect(hasCachePoint(getSentInput())).toBe(true);
  });

  test('画像を含む最新 user メッセージには cachePoint を付ける（画像はキャッシュ可能）', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'describe',
      extraData: [
        {
          type: 'image',
          name: 'pic.png',
          source: {
            type: 's3',
            mediaType: 'image/png',
            data: `s3://${BUCKET}/${IDENTITY}/uuid/pic.png`,
          },
        },
      ],
    };
    await bedrockApi.invoke(CACHE_MODEL, [msg], '/chat', IDENTITY);
    expect(hasCachePoint(getSentInput())).toBe(true);
  });

  test('pdf document を含む最新 user メッセージには cachePoint を付ける（pdf はキャッシュ可能）', async () => {
    await bedrockApi.invoke(CACHE_MODEL, [s3Doc('report.pdf')], '/chat', IDENTITY);
    expect(hasCachePoint(getSentInput())).toBe(true);
  });

  test('md document を含む最新 user メッセージには cachePoint を付けない', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'read this',
      extraData: [
        {
          type: 'file',
          name: 'appendix.md',
          source: {
            type: 's3',
            mediaType: 'text/markdown',
            data: `s3://${BUCKET}/${IDENTITY}/uuid/appendix.md`,
          },
        },
      ],
    };
    await bedrockApi.invoke(CACHE_MODEL, [msg], '/chat', IDENTITY);
    expect(hasCachePoint(getSentInput())).toBe(false);
  });

  test('txt document を含む最新 user メッセージにも cachePoint を付けない', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'read this',
      extraData: [
        {
          type: 'file',
          name: 'notice.txt',
          source: {
            type: 's3',
            mediaType: 'text/plain',
            data: `s3://${BUCKET}/${IDENTITY}/uuid/notice.txt`,
          },
        },
      ],
    };
    await bedrockApi.invoke(CACHE_MODEL, [msg], '/chat', IDENTITY);
    expect(hasCachePoint(getSentInput())).toBe(false);
  });

  test('docx document を含む最新 user メッセージには cachePoint を付けない（Word 回帰）', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'read this',
      extraData: [
        {
          type: 'file',
          name: 'report.docx',
          source: {
            type: 's3',
            mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            data: `s3://${BUCKET}/${IDENTITY}/uuid/report.docx`,
          },
        },
      ],
    };
    await bedrockApi.invoke(CACHE_MODEL, [msg], '/chat', IDENTITY);
    expect(hasCachePoint(getSentInput())).toBe(false);
  });

  test('xlsx document を含む最新 user メッセージには cachePoint を付けない（Excel 回帰）', async () => {
    const msg: UnrecordedMessage = {
      role: 'user',
      content: 'read this',
      extraData: [
        {
          type: 'file',
          name: 'sheet.xlsx',
          source: {
            type: 's3',
            mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            data: `s3://${BUCKET}/${IDENTITY}/uuid/sheet.xlsx`,
          },
        },
      ],
    };
    await bedrockApi.invoke(CACHE_MODEL, [msg], '/chat', IDENTITY);
    expect(hasCachePoint(getSentInput())).toBe(false);
  });

  test('会話履歴の末尾 user が添付ありなら cachePoint を付けない（messages.N.content.2 回帰）', async () => {
    // text のみのやり取りを重ねた後、最新ターンで添付する構成
    const history: UnrecordedMessage[] = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
      { role: 'assistant', content: 'a2' },
      {
        role: 'user',
        content: 'read this',
        extraData: [
          {
            type: 'file',
            name: 'notice.txt',
            source: {
              type: 's3',
              mediaType: 'text/plain',
              data: `s3://${BUCKET}/${IDENTITY}/uuid/notice.txt`,
            },
          },
        ],
      },
    ];
    await bedrockApi.invoke(CACHE_MODEL, history, '/chat', IDENTITY);
    expect(hasCachePoint(getSentInput())).toBe(false);
  });
});
