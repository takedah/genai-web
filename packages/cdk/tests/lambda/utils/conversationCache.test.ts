import { ContentBlock, ConversationRole } from '@aws-sdk/client-bedrock-runtime';
import { UnrecordedMessage } from 'genai-web';
import { describe, expect, it } from 'vitest';
import {
  appendCachePointToConversation,
  createConverseCommandInput,
  createConverseCommandInputWithoutSystemContext,
  createConverseStreamCommandInput,
  isChatUsecase,
} from '../../../lambda/utils/models';

// createConverseCommandInput はモデル設定由来の defaultParams / usecaseParams を受け取るが、
// 会話 cachePoint 付与の検証には影響しないため空オブジェクトで十分。
const EMPTY_DEFAULT_PARAMS = {} as never;
const EMPTY_USECASE_PARAMS = {} as never;

const CHAT_ID = '/chat/abc-123';
const RAG_ID = '/rag';

const textMessage = (
  role: ConversationRole,
  text: string,
): { role: ConversationRole; content: ContentBlock[] } => ({
  role,
  content: [{ text } as ContentBlock.TextMember],
});

const hasCachePoint = (content: ContentBlock[]): boolean =>
  content.some((block) => 'cachePoint' in block);

describe('isChatUsecase', () => {
  it('チャット履歴 id（/chat/xxx）は true', () => {
    expect(isChatUsecase('/chat/abc-123')).toBe(true);
  });

  it('チャットトップ（/chat）も true', () => {
    expect(isChatUsecase('/chat')).toBe(true);
  });

  it('非チャット経路（/rag, /generate 等）は false', () => {
    expect(isChatUsecase('/rag')).toBe(false);
    expect(isChatUsecase('/generate')).toBe(false);
    expect(isChatUsecase('/summarize')).toBe(false);
  });

  it('空文字は false', () => {
    expect(isChatUsecase('')).toBe(false);
  });
});

describe('appendCachePointToConversation', () => {
  it('最後の user メッセージ末尾に cachePoint を 1 個付与する（ttl 明示=Claude 相当）', () => {
    const conversation = [
      textMessage(ConversationRole.USER, 'first'),
      textMessage(ConversationRole.ASSISTANT, 'answer'),
      textMessage(ConversationRole.USER, 'second'),
    ];

    const result = appendCachePointToConversation(conversation, { ttl: '5m' });

    // 最後の user（index 2）に付与
    const lastUserContent = result[2].content;
    expect(lastUserContent).toHaveLength(2);
    const cachePointBlock = lastUserContent[1] as ContentBlock.CachePointMember;
    expect(cachePointBlock.cachePoint).toEqual({ type: 'default', ttl: '5m' });
    // それ以外のメッセージには付かない
    expect(hasCachePoint(result[0].content)).toBe(false);
    expect(hasCachePoint(result[1].content)).toBe(false);
  });

  it('ttl 省略時は ttl を含まない cachePoint を付与する（Nova 相当）', () => {
    const conversation = [textMessage(ConversationRole.USER, 'hello')];

    const result = appendCachePointToConversation(conversation, {});

    const cachePointBlock = result[0].content[1] as ContentBlock.CachePointMember;
    expect(cachePointBlock.cachePoint).toEqual({ type: 'default' });
    expect(cachePointBlock.cachePoint).not.toHaveProperty('ttl');
  });

  it('user メッセージが無い場合は付与しない', () => {
    const conversation = [textMessage(ConversationRole.ASSISTANT, 'system-ish')];

    const result = appendCachePointToConversation(conversation, { ttl: '5m' });

    expect(hasCachePoint(result[0].content)).toBe(false);
  });

  it('assistant が末尾でも、cachePoint は最後の user に付く', () => {
    const conversation = [
      textMessage(ConversationRole.USER, 'q'),
      textMessage(ConversationRole.ASSISTANT, 'a'),
    ];

    const result = appendCachePointToConversation(conversation, { ttl: '5m' });

    expect(hasCachePoint(result[0].content)).toBe(true); // user
    expect(hasCachePoint(result[1].content)).toBe(false); // assistant
  });

  it('画像を含むメッセージには cachePoint を付与する（画像はキャッシュ可能）', () => {
    const conversation = [
      {
        role: ConversationRole.USER,
        content: [
          { text: 'describe' } as ContentBlock.TextMember,
          {
            image: { format: 'png', source: { bytes: new Uint8Array([1, 2, 3]) } },
          } as ContentBlock.ImageMember,
        ],
      },
    ];

    const result = appendCachePointToConversation(conversation, { ttl: '5m' });

    const content = result[0].content;
    expect(content).toHaveLength(3);
    expect('text' in content[0]).toBe(true);
    expect('image' in content[1]).toBe(true);
    expect('cachePoint' in content[2]).toBe(true);
  });

  it('pdf 以外の document（テキスト抽出系・未知 format・format 未指定）には cachePoint を付与しない', () => {
    // pdf 以外と cachePoint を同居させると Bedrock が content を解釈できず
    // ValidationException になるため付与しない（allowlist=pdf のみ / deny by default）。
    // Bedrock DocumentBlock.format 全列挙（pdf 除く）に加え、想定外値と未指定も網羅する。
    const formats: (string | undefined)[] = [
      'md',
      'txt',
      'csv',
      'html',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'gif', // フロントが doc 区分で許可しており document として届きうる
      'unknown', // 将来追加され得る想定外 format も安全側に倒れること
      undefined, // format 未指定も同様
    ];
    for (const format of formats) {
      const conversation = [
        {
          role: ConversationRole.USER,
          content: [
            { text: 'read this' } as ContentBlock.TextMember,
            {
              document: { format, name: 'doc-0', source: { bytes: new Uint8Array([1]) } },
            } as ContentBlock.DocumentMember,
          ],
        },
      ];

      const result = appendCachePointToConversation(conversation, { ttl: '5m' });

      expect(result[0].content).toHaveLength(2);
      expect(result[0].content.some((b) => 'cachePoint' in b)).toBe(false);
    }
  });

  it('pdf document を含むメッセージには cachePoint を付与する（pdf のみ同居可能）', () => {
    const conversation = [
      {
        role: ConversationRole.USER,
        content: [
          { text: 'read this' } as ContentBlock.TextMember,
          {
            document: { format: 'pdf', name: 'doc-0', source: { bytes: new Uint8Array([1]) } },
          } as ContentBlock.DocumentMember,
        ],
      },
    ];

    const result = appendCachePointToConversation(conversation, { ttl: '5m' });

    expect(result[0].content).toHaveLength(3);
    expect('cachePoint' in result[0].content[2]).toBe(true);
  });

  it('video を含むメッセージには cachePoint を付与しない', () => {
    const conversation = [
      {
        role: ConversationRole.USER,
        content: [
          { text: 'watch' } as ContentBlock.TextMember,
          {
            video: { format: 'mp4', source: { s3Location: { uri: 's3://b/v.mp4' } } },
          } as ContentBlock.VideoMember,
        ],
      },
    ];

    const result = appendCachePointToConversation(conversation, { ttl: '5m' });

    expect(result[0].content).toHaveLength(2);
    expect(result[0].content.some((b) => 'cachePoint' in b)).toBe(false);
  });

  it('テキスト抽出系 document を含む最後の user では付与せず、他メッセージは保持する', () => {
    const conversation = [
      {
        role: ConversationRole.USER,
        content: [{ text: 'first' } as ContentBlock.TextMember],
      },
      {
        role: ConversationRole.USER,
        content: [
          { text: 'with file' } as ContentBlock.TextMember,
          {
            document: { format: 'md', name: 'd-0', source: { bytes: new Uint8Array([1]) } },
          } as ContentBlock.DocumentMember,
        ],
      },
    ];

    const result = appendCachePointToConversation(conversation, { ttl: '5m' });

    // どのメッセージにも cachePoint は付かない（最後の user が添付ありのため）
    expect(result.flatMap((m) => m.content).some((b) => 'cachePoint' in b)).toBe(false);
    expect(result[0].content).toHaveLength(1);
    expect(result[1].content).toHaveLength(2);
  });

  it('元の配列を破壊しない（不変更新）', () => {
    const conversation = [textMessage(ConversationRole.USER, 'x')];
    const originalLength = conversation[0].content.length;

    appendCachePointToConversation(conversation, { ttl: '5m' });

    expect(conversation[0].content).toHaveLength(originalLength);
  });
});

describe('createConverseCommandInput - 会話 cachePoint 付与', () => {
  const buildMessages = (): UnrecordedMessage[] => [
    { role: 'system', content: 'you are helpful' },
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'hello' },
    { role: 'user', content: 'how are you' },
  ];

  const lastMessageContent = (input: Awaited<ReturnType<typeof createConverseCommandInput>>) => {
    const messages = input.messages ?? [];
    return messages[messages.length - 1].content ?? [];
  };

  it('対応モデル（Claude）×チャット id で最後の user に ttl=5m の cachePoint が付く', async () => {
    const input = await createConverseCommandInput(
      buildMessages(),
      CHAT_ID,
      'jp.anthropic.claude-sonnet-4-6',
      EMPTY_DEFAULT_PARAMS,
      EMPTY_USECASE_PARAMS,
    );

    const content = lastMessageContent(input);
    const cachePointBlock = content[content.length - 1] as ContentBlock.CachePointMember;
    expect(cachePointBlock.cachePoint).toEqual({ type: 'default', ttl: '5m' });
  });

  it('対応モデル（Nova）×チャット id で ttl 無しの cachePoint が付く', async () => {
    const input = await createConverseCommandInput(
      buildMessages(),
      CHAT_ID,
      'apac.amazon.nova-pro-v1:0',
      EMPTY_DEFAULT_PARAMS,
      EMPTY_USECASE_PARAMS,
    );

    const content = lastMessageContent(input);
    const cachePointBlock = content[content.length - 1] as ContentBlock.CachePointMember;
    expect(cachePointBlock.cachePoint).toEqual({ type: 'default' });
  });

  it('非対応モデル（Claude 3.7）×チャット id では cachePoint が付かない', async () => {
    const input = await createConverseCommandInput(
      buildMessages(),
      CHAT_ID,
      'apac.anthropic.claude-3-7-sonnet-20250219-v1:0',
      EMPTY_DEFAULT_PARAMS,
      EMPTY_USECASE_PARAMS,
    );

    const messages = input.messages ?? [];
    expect(messages.every((m) => !hasCachePoint(m.content ?? []))).toBe(true);
  });

  it('対応モデル×非チャット id（/rag）では cachePoint が付かない', async () => {
    const input = await createConverseCommandInput(
      buildMessages(),
      RAG_ID,
      'jp.anthropic.claude-sonnet-4-6',
      EMPTY_DEFAULT_PARAMS,
      EMPTY_USECASE_PARAMS,
    );

    const messages = input.messages ?? [];
    expect(messages.every((m) => !hasCachePoint(m.content ?? []))).toBe(true);
  });

  it('対応モデル×チャット id では system 側 cachePoint には影響しない（system は別経路で付与）', async () => {
    // createConverseCommandInput は system に cachePoint を付与しない（bedrockApi 層の責務）。
    // 会話 cachePoint 付与が system context を汚さないことを確認する。
    const input = await createConverseCommandInput(
      buildMessages(),
      CHAT_ID,
      'jp.anthropic.claude-sonnet-4-6',
      EMPTY_DEFAULT_PARAMS,
      EMPTY_USECASE_PARAMS,
    );

    const system = input.system ?? [];
    expect(system.some((block) => 'cachePoint' in block)).toBe(false);
  });
});

describe('createConverseStreamCommandInput - ストリーム経路でも同一付与', () => {
  const buildMessages = (): UnrecordedMessage[] => [
    { role: 'system', content: 'you are helpful' },
    { role: 'user', content: 'streaming question' },
  ];

  it('対応モデル（Claude）×チャット id でストリーム経路でも cachePoint が付く', async () => {
    const input = await createConverseStreamCommandInput(
      buildMessages(),
      CHAT_ID,
      'jp.anthropic.claude-sonnet-4-6',
      EMPTY_DEFAULT_PARAMS,
      EMPTY_USECASE_PARAMS,
    );

    const messages = input.messages ?? [];
    const lastContent = messages[messages.length - 1].content ?? [];
    const cachePointBlock = lastContent[lastContent.length - 1] as ContentBlock.CachePointMember;
    expect(cachePointBlock.cachePoint).toEqual({ type: 'default', ttl: '5m' });
  });
});

describe('createConverseCommandInputWithoutSystemContext - 会話 cachePoint 非対象', () => {
  it('system 非対応モデル（Titan/Mistral 等）はチャット id でも cachePoint を付与しない', async () => {
    // WithoutSystemContext 経路はキャッシュ非対応モデル専用で conversationCache 未設定のため、
    // チャット id でも会話 cachePoint は付かない。
    const input = await createConverseCommandInputWithoutSystemContext(
      [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: 'again' },
      ],
      CHAT_ID,
      'amazon.titan-text-premier-v1:0',
      EMPTY_DEFAULT_PARAMS,
      EMPTY_USECASE_PARAMS,
    );

    const messages = input.messages ?? [];
    expect(messages.every((m) => !hasCachePoint(m.content ?? []))).toBe(true);
  });
});
