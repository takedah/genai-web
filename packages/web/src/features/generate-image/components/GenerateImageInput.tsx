import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router';
import { AutoResizeTextarea } from '@/components/ui/AutoResizeTextarea';
import { ErrorText } from '@/components/ui/dads/ErrorText';
import { SendIcon } from '@/components/ui/icons/SendIcon';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { useChat } from '@/hooks/useChat';
import { isSubmitKey } from '@/utils/keyboard';
import { type GenerateImageChatFormSchema, generateImageChatFormSchema } from '../schema';

type Props = {
  textareaId: string;
  content: string;
  loading?: boolean;
  onChangeContent: (content: string) => void;
  onSend: () => void;
};

export const GenerateImageInput = (props: Props) => {
  const { textareaId, content, onChangeContent, onSend } = props;

  const { pathname } = useLocation();
  const { loading: chatLoading } = useChat(pathname);

  const loading = props.loading === undefined ? chatLoading : props.loading;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<GenerateImageChatFormSchema>({
    mode: 'onSubmit',
    resolver: zodResolver(generateImageChatFormSchema),
    values: {
      content,
    },
  });

  const onSubmit = handleSubmit((data) => {
    if (loading) return;
    onChangeContent(data.content);
    onSend();
  });

  return (
    <form className='w-full' aria-labelledby={`${textareaId}-heading`} onSubmit={onSubmit}>
      <h2 id={`${textareaId}-heading`} className='self-start my-1 text-std-16N-170'>
        生成したい画像の内容を入力してみましょう
      </h2>
      <div className='grid w-full grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2'>
        <AutoResizeTextarea
          id={textareaId}
          className='resize-none col-start-1 row-start-1 py-[calc(11/16*1rem)]!'
          required
          aria-labelledby={`${textareaId}-heading`}
          aria-describedby={`${textareaId}-error`}
          onKeyDown={(e) => {
            if (isSubmitKey(e)) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          {...register('content', {
            onChange: (e) => {
              setValue('content', e.target.value);
              onChangeContent(e.target.value);
            },
          })}
        />

        {errors.content && (
          <ErrorText id={`${textareaId}-error`} className='col-span-full row-start-2 mt-2'>
            ＊{errors.content.message}
          </ErrorText>
        )}

        <LoadingButton
          type='submit'
          variant='solid-fill'
          size='md'
          disabled={loading}
          onClick={() => {}}
          className='col-start-2 row-start-1 shrink-0 inline-flex justify-center items-center gap-1 min-w-32'
        >
          <SendIcon aria-hidden={true} className='shrink-0' />
          {loading ? '生成中' : '送信'}
        </LoadingButton>
      </div>
    </form>
  );
};
