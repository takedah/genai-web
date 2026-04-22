import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GenerateImageRequest } from 'genai-web';
import api from './utils/api';
import { HttpError } from './utils/httpError';
import { defaultImageGenerationModel } from './utils/models';
import { parseJsonBody } from './utils/parseJsonBody';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const req = parseJsonBody(event.body) as GenerateImageRequest;
    const model = req.model || defaultImageGenerationModel;
    const res = await (
      api[model.type] as { generateImage: (model: any, params: any) => Promise<string> }
    ).generateImage(model, req.params);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: res,
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error(error);
    if (error instanceof HttpError) {
      return {
        statusCode: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: error.message }),
      };
    }
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: (error as Error).message }),
    };
  }
};
