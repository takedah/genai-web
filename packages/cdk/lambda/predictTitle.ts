import { PredictTitleRequest, UnrecordedMessage } from 'genai-web';
import { setChatTitle } from './repository/chatRepository';
import api from './utils/api';
import { createApiHandler } from './utils/createApiHandler';
import { defaultModel } from './utils/models';

export const handler = createApiHandler(async (event) => {
  if (!event.body) {
    throw new Error('Request body is missing');
  }

  const req = JSON.parse(event.body) as PredictTitleRequest;

  if (!req.prompt || !req.chat?.id || !req.chat?.createdDate || !req.id) {
    throw new Error('Invalid request format');
  }

  const model = defaultModel;

  const messages: UnrecordedMessage[] = [
    {
      role: 'user',
      content: req.prompt,
    },
  ];

  // 新規モデル追加時は、デフォルトで Claude の prompter が利用されるため
  // 出力が <output></output> で囲まれる可能性がある
  // 以下の処理ではそれに対応するため、<output></output> を含む xml タグを削除している
  const title =
    (await api['bedrock'].invoke?.(model, messages, req.id))?.replace(
      /<([^>]+)>([\s\S]*?)<\/\1>/,
      '$2',
    ) ?? '';

  await setChatTitle(req.chat.id, req.chat.createdDate, title);

  return {
    statusCode: 200,
    body: title,
  };
});
