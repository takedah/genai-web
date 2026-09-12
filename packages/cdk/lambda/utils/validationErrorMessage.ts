type ValidationErrorRule = {
  category: string;
  match: (message: string) => boolean;
  japaneseMessage: string;
};

const rules: ValidationErrorRule[] = [
  {
    category: 'pdf-password-protected',
    match: (message) => message.includes('password protected'),
    japaneseMessage:
      '添付された PDF がパスワードで保護されているため読み込めませんでした。新規チャットボタンから新しいチャットを開始し、保護を解除した PDF を添付して送り直してください。',
  },
  {
    category: 'input-too-long',
    match: (message) => message.includes('prompt is too long'),
    japaneseMessage:
      '入力内容（メッセージ・添付ファイル・これまでの会話）が長すぎるため送信できませんでした。新規チャットボタンから新しいチャットを開始し、メッセージや添付ファイルを減らして送り直してください。',
  },
  {
    category: 'document-too-large',
    match: (message) => message.includes('maximum document size'),
    japaneseMessage:
      '添付ファイルのサイズが上限（4.5MB）を超えています。Excel（.xlsx）や Word（.docx）などのファイルは、お使いの端末で表示されるサイズよりも処理時に展開されたサイズが大きくなる場合があり、端末上で 4.5MB 未満でも上限を超えることがあります。新規チャットボタンから新しいチャットを開始し、ファイルの内容を減らすか分割して送り直してください。',
  },
  {
    category: 'too-many-documents',
    match: (message) => message.includes('more than') && message.includes('documents'),
    japaneseMessage:
      '一度に添付できるファイルは5個までです。新規チャットボタンから新しいチャットを開始し、添付するファイルの数を減らして送り直してください。',
  },
  {
    category: 'too-many-pdf-pages',
    match: (message) => message.includes('pdf pages'),
    japaneseMessage:
      '添付された PDF のページ数が上限を超えています。上限は利用するモデルによって異なるため、より多くのページを扱えるモデルに変更すると処理できる場合があります。あるいは、新規チャットボタンから新しいチャットを開始し、ページ数を減らすか PDF を分割して送り直してください。',
  },
  {
    category: 'unsupported-file-type',
    match: (message) => message.includes('unsupported mime type'),
    japaneseMessage:
      '添付されたファイルの形式に対応していません。新規チャットボタンから新しいチャットを開始し、対応形式（pdf, csv, txt, md, doc, docx, xls, xlsx, html）に変換して送り直してください。テキストファイルの場合は、文字コードが Shift-JIS 等の可能性があるため UTF-8 形式で保存し直すと解決することがあります。',
  },
  {
    category: 'invalid-file-name',
    match: (message) => message.includes('file name can only contain'),
    japaneseMessage:
      '添付ファイルのファイル名に使用できない文字、または連続した空白が含まれています。新規チャットボタンから新しいチャットを開始し、ファイル名を変更して送り直してください。',
  },
  {
    category: 'malformed-request',
    match: (message) => message.includes('field required'),
    japaneseMessage:
      '送信データの形式に問題が発生しました。ページを再読み込みして再度お試しください。解消しない場合は管理者にお問い合わせください。',
  },
];

export const mapValidationExceptionMessage = (rawMessage: string): string | undefined => {
  if (!rawMessage) {
    return undefined;
  }

  const normalized = rawMessage.toLowerCase();
  return rules.find((rule) => rule.match(normalized))?.japaneseMessage;
};
