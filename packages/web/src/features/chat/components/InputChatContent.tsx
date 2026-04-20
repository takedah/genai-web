import { zodResolver } from '@hookform/resolvers/zod';
import type { FileLimit } from 'genai-web';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { PiArrowsCounterClockwise, PiSpinnerGap } from 'react-icons/pi';
import { useLocation } from 'react-router';
import { AutoResizeTextarea } from '@/components/ui/AutoResizeTextarea';
import { Button } from '@/components/ui/dads/Button';
import { ErrorText } from '@/components/ui/dads/ErrorText';
import { AttachmentIcon } from '@/components/ui/icons/AttachmentIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { FileCard } from '@/features/chat/components/FileCard';
import { SendButton } from '@/features/chat/components/SendButton';
import { ZoomUpImage } from '@/features/chat/components/ZoomUpImage';
import { ZoomUpVideo } from '@/features/chat/components/ZoomUpVideo';
import { useChat } from '@/hooks/useChat';
import { useFiles } from '@/hooks/useFiles';
import { focus } from '@/utils/focus';
import { isSubmitKey } from '@/utils/keyboard';
import { ChatFormSchema, chatFormSchema } from '../schema';

type Props = {
  textareaId: string;
  content: string;
  disabled?: boolean;
  placeholder?: string;
  resetDisabled?: boolean;
  'aria-labelledby'?: string;
  onChangeContent: (content: string) => void;
  onSend: () => void;
  onReset: () => void;
  fileUpload: boolean;
  fileLimit: FileLimit;
  accept: string[];
};

export const InputChatContent = (props: Props) => {
  const { pathname } = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loading: chatLoading, isEmpty } = useChat(pathname);
  const { uploadedFiles, uploadFiles, checkFiles, deleteUploadedFile, uploading, errorMessages } =
    useFiles(pathname);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ChatFormSchema>({
    mode: 'onSubmit',
    resolver: zodResolver(chatFormSchema),
    values: {
      content: props.content,
    },
  });

  // Model 変更等で accept が変更された際にエラーメッセージを表示 (自動でファイル削除は行わない)
  useEffect(() => {
    checkFiles(props.fileLimit, props.accept);
  }, [checkFiles, props.fileLimit, props.accept]);

  const onChangeFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) {
      return;
    }

    uploadFiles(Array.from(files), props.fileLimit, props.accept);
  };

  const deleteFile = async (fileUrl: string) => {
    await deleteUploadedFile(fileUrl, props.fileLimit, props.accept);
    focus(props.textareaId);
  };
  const handlePaste = async (pasteEvent: React.ClipboardEvent) => {
    const fileList = pasteEvent.clipboardData.items || [];
    const files = Array.from(fileList)
      .filter((file) => file.kind === 'file')
      .map((file) => file.getAsFile() as File);

    if (files.length > 0) {
      // ファイルをアップロード
      uploadFiles(Array.from(files), props.fileLimit, props.accept);
      // ファイルの場合ファイル名もペーストされるためデフォルトの挙動を止める
      pasteEvent.preventDefault();
    }
    // ファイルがない場合はデフォルトの挙動（テキストのペースト）
  };

  const handleClickFileUpload = () => {
    if (uploading) {
      return;
    }
    fileInputRef.current?.click();
  };

  const disabledSend = props.disabled || uploading || errorMessages.length > 0;

  const onSubmit = handleSubmit((data) => {
    if (disabledSend) {
      return;
    }

    props.onChangeContent(data.content);
    props.onSend();
  });

  return (
    <form className={`w-full px-6 py-4`} onSubmit={onSubmit}>
      <div className='relative flex items-end bg-white'>
        <div className='flex w-full flex-col-reverse'>
          <div className='relative flex flex-col'>
            <AutoResizeTextarea
              id={props.textareaId}
              className={`resize-none ${props.fileUpload ? 'pr-24' : 'pr-14'}`}
              placeholder={props.placeholder ?? '入力してください'}
              aria-labelledby={props['aria-labelledby']}
              aria-describedby={errors.content ? `${props.textareaId}-error` : undefined}
              onPaste={props.fileUpload ? handlePaste : undefined}
              onKeyDown={(e) => {
                if (isSubmitKey(e)) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              {...register('content', {
                onChange: (e) => {
                  setValue('content', e.target.value);
                  props.onChangeContent(e.target.value);
                },
              })}
            />

            <div className='absolute right-[calc(116/16*1rem)] bottom-[calc(21/16*1rem)]'>
              {errors.content && (
                <ErrorText id={`${props.textareaId}-error`} className='text-oln-16N-100!'>
                  ＊{errors.content.message}
                </ErrorText>
              )}
            </div>

            <div>
              {props.fileUpload && (
                <div className='absolute right-[calc(60/16*1rem)] bottom-[calc(7/16*1rem)]'>
                  <input
                    hidden
                    ref={fileInputRef}
                    onChange={onChangeFiles}
                    type='file'
                    accept={props.accept?.join(',')}
                    multiple
                    value={[]}
                  />
                  <Tooltip offset={8}>
                    <TooltipTrigger asChild>
                      <Button
                        variant='outline'
                        type='button'
                        size='sm'
                        className='inline-flex size-11! min-w-0! items-center justify-center p-0!'
                        onClick={handleClickFileUpload}
                      >
                        {uploading ? (
                          <PiSpinnerGap
                            aria-label='ファイルをアップロード中'
                            role='img'
                            className='size-5 animate-spin'
                          />
                        ) : (
                          <AttachmentIcon
                            aria-label={`ファイルを添付（${props.fileLimit.maxFileSizeMB}MBまで）`}
                            role='img'
                          />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent aria-hidden={true}>
                      ファイル添付（{props.fileLimit.maxFileSizeMB}MBまで）
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              <SendButton
                type='submit'
                className='absolute! right-2 bottom-[calc(7/16*1rem)]'
                disabled={disabledSend}
                loading={chatLoading || uploading}
                onClick={() => {}}
              />
            </div>

            {!isEmpty && !props.resetDisabled && (
              <Button
                className='absolute! -top-9 right-1 inline-flex items-center justify-center'
                variant='outline'
                size='xs'
                disabled={chatLoading}
                onClick={() => {
                  setValue('content', '');
                  props.onReset();
                }}
              >
                <PiArrowsCounterClockwise className='mr-2' />
                最初からやり直す
              </Button>
            )}
          </div>

          {props.fileUpload && uploadedFiles.length > 0 && (
            <div>
              <h3 className='sr-only'>添付ファイル</h3>
              <ul className='m-2 flex flex-wrap gap-4'>
                {uploadedFiles.map((uploadedFile, idx) => {
                  if (uploadedFile.type === 'image') {
                    return (
                      <li key={idx}>
                        <ZoomUpImage
                          filename={uploadedFile.name}
                          src={uploadedFile.base64EncodedData}
                          loading={uploadedFile.uploading}
                          deleting={uploadedFile.deleting}
                          size='sm'
                          hasTooltip={true}
                          error={uploadedFile.errorMessages.length > 0}
                          onDelete={() => {
                            deleteFile(uploadedFile.s3Url ?? '');
                          }}
                        />
                      </li>
                    );
                  } else if (uploadedFile.type === 'video') {
                    return (
                      <li key={idx}>
                        <ZoomUpVideo
                          src={uploadedFile.base64EncodedData}
                          loading={uploadedFile.uploading}
                          deleting={uploadedFile.deleting}
                          size='sm'
                          hasTooltip={true}
                          filename={uploadedFile.name}
                          error={uploadedFile.errorMessages.length > 0}
                          onDelete={() => {
                            deleteFile(uploadedFile.s3Url ?? '');
                          }}
                        />
                      </li>
                    );
                  } else {
                    return (
                      <li key={idx}>
                        <FileCard
                          filename={uploadedFile.name}
                          filetype={uploadedFile.name.split('.').pop() as string}
                          loading={uploadedFile.uploading}
                          deleting={uploadedFile.deleting}
                          size='sm'
                          error={uploadedFile.errorMessages.length > 0}
                          onDelete={() => {
                            deleteFile(uploadedFile.s3Url ?? '');
                          }}
                        />
                      </li>
                    );
                  }
                })}
              </ul>
            </div>
          )}

          {errorMessages.length > 0 && (
            <div className='m-2 flex flex-wrap gap-2'>
              {errorMessages.map((errorMessage, idx) => (
                <p key={idx} className='text-dns-16N-130 text-error-1'>
                  ＊{errorMessage}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </form>
  );
};
