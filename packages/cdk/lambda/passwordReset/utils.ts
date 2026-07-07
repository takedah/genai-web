import {
  createHash,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

export const generateSixDigitCode = (): string =>
  randomInt(0, 1_000_000).toString().padStart(6, '0');

export const generateResetRecordId = (): string => randomBytes(32).toString('base64url');

export const generateCodeSalt = (): string => randomBytes(16).toString('base64url');

export const hashVerificationCode = async (code: string, salt: string): Promise<string> => {
  const key = (await scrypt(code, salt, 32)) as Buffer;
  return key.toString('hex');
};

export const verifyVerificationCode = async (
  code: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> => {
  const actualHash = await hashVerificationCode(code, salt);
  const actual = Buffer.from(actualHash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
