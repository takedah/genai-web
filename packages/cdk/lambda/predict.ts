import { InvokeInterface, PredictRequest } from 'genai-web';
import api from './utils/api';
import { createApiHandler } from './utils/createApiHandler';
import { defaultModel } from './utils/models';

export const handler = createApiHandler(async (event) => {
  const req: PredictRequest = JSON.parse(event.body!);

  const model = req.model || defaultModel;

  const response = await (api[model.type] as { invoke?: InvokeInterface }).invoke?.(
    model,
    req.messages,
    req.id,
  );

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
