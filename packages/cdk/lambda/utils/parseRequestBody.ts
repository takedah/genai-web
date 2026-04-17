import type { z } from 'zod';
import { HttpError } from './httpError';

export const parseRequestBody = <T>(schema: z.ZodType<T>, body: string): T => {
  const result = schema.safeParse(JSON.parse(body));
  if (!result.success) {
    throw new HttpError(400, result.error.issues[0].message);
  }
  return result.data;
};
