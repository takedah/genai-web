import { describe, expect, test } from 'vitest';
import { mapValidationExceptionMessage } from '../../../lambda/utils/validationErrorMessage';

describe('mapValidationExceptionMessage', () => {
  test('入力トークン超過を日本語メッセージに変換する', () => {
    const message =
      'The model returned the following errors: prompt is too long: 1750303 tokens > 1000000 maximum';
    expect(mapValidationExceptionMessage(message)).toContain('入力内容');
    expect(mapValidationExceptionMessage(message)).toContain('新規チャット');
  });

  test('ドキュメントサイズ超過を日本語メッセージに変換する', () => {
    const message =
      'The maximum document size is 4.5 MB. Reduce the size of your document and retry your request.';
    const result = mapValidationExceptionMessage(message);
    expect(result).toContain('4.5MB');
    expect(result).toContain('展開');
    expect(result).toContain('新規チャット');
  });

  test('ドキュメント数超過を日本語メッセージに変換する', () => {
    const message =
      "You can't include more than 5 documents in a request. Reduce the number of documents and retry your request.";
    const result = mapValidationExceptionMessage(message);
    expect(result).toContain('5個まで');
    expect(result).toContain('新規チャット');
  });

  test('PDFページ数超過を日本語メッセージに変換する', () => {
    const message =
      'The model returned the following errors: A maximum of 100 PDF pages may be provided.';
    const result = mapValidationExceptionMessage(message);
    expect(result).toContain('ページ数が上限');
    expect(result).toContain('モデルに変更');
    expect(result).toContain('新規チャット');
  });

  test('PDFパスワード保護を日本語メッセージに変換する', () => {
    const message =
      'The model returned the following errors: messages.38.content.1.pdf.source.base64.data: The PDF specified is password protected.';
    const result = mapValidationExceptionMessage(message);
    expect(result).toContain('パスワードで保護');
    expect(result).toContain('新規チャット');
  });

  test('ファイル形式非対応を日本語メッセージに変換する', () => {
    const message =
      'Unsupported MIME type: application/octet-stream. Retry your request with a supported file type: xlsx, txt, pdf, csv, md, doc, html, xls, docx';
    const result = mapValidationExceptionMessage(message);
    expect(result).toContain('形式に対応していません');
    expect(result).toContain('UTF-8');
    expect(result).toContain('新規チャット');
  });

  test('ファイル名の使用不可文字を日本語メッセージに変換する', () => {
    const message =
      "The document file name can only contain alphanumeric characters, whitespace characters, hyphens, parentheses, and square brackets. The name can't contain more than one consecutive whitespace character.";
    const result = mapValidationExceptionMessage(message);
    expect(result).toContain('ファイル名');
    expect(result).toContain('新規チャット');
  });

  test('リクエスト構造不正を日本語メッセージに変換する', () => {
    const message =
      'The model returned the following errors: messages.0.content.2.type: Field required';
    expect(mapValidationExceptionMessage(message)).toContain('再読み込み');
  });

  test('未分類のメッセージはundefinedを返す', () => {
    expect(mapValidationExceptionMessage('Some unexpected error occurred')).toBeUndefined();
  });

  test('空文字は例外を投げずにundefinedを返す', () => {
    expect(mapValidationExceptionMessage('')).toBeUndefined();
  });

  test('パスワード保護とField requiredを両方含む場合はパスワード保護を優先する', () => {
    const message =
      'The model returned the following errors: messages.0.content.1.pdf.source.base64.data: The PDF specified is password protected. messages.0.content.2.type: Field required';
    expect(mapValidationExceptionMessage(message)).toContain('パスワードで保護');
  });

  test('変換後の日本語メッセージに英語の生エラー文が含まれない', () => {
    const observedMessages = [
      'The model returned the following errors: prompt is too long: 1750303 tokens > 1000000 maximum',
      'The maximum document size is 4.5 MB. Reduce the size of your document and retry your request.',
      "You can't include more than 5 documents in a request. Reduce the number of documents and retry your request.",
      'The model returned the following errors: A maximum of 100 PDF pages may be provided.',
      'The model returned the following errors: messages.38.content.1.pdf.source.base64.data: The PDF specified is password protected.',
      'Unsupported MIME type: application/octet-stream. Retry your request with a supported file type: xlsx, txt, pdf, csv, md, doc, html, xls, docx',
      "The document file name can only contain alphanumeric characters, whitespace characters, hyphens, parentheses, and square brackets.",
      'The model returned the following errors: messages.0.content.2.type: Field required',
    ];
    const englishKeys = [
      'prompt is too long',
      'maximum document size',
      'more than',
      'PDF pages may be provided',
      'password protected',
      'Unsupported MIME type',
      'file name can only contain',
      'Field required',
    ];

    for (const message of observedMessages) {
      const result = mapValidationExceptionMessage(message);
      expect(result).toBeDefined();
      for (const key of englishKeys) {
        expect(result).not.toContain(key);
      }
    }
  });
});
