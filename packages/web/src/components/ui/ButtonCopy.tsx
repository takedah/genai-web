import type React from 'react';
import { useState } from 'react';
import { PiCheck, PiClipboard } from 'react-icons/pi';
import { ButtonIcon } from '@/components/ui/ButtonIcon';

type Props = {
  className?: string;
  text: string;
  disabled?: boolean;
  targetRef?: React.RefObject<HTMLElement | null>;
};

export const ButtonCopy = (props: Props) => {
  const { className, text, disabled, targetRef } = props;
  const [isShowsCheck, setIsShowsCheck] = useState(false);

  const copyMessage = async (message: string) => {
    if (isShowsCheck) {
      return;
    }

    if (!message || message === '') {
      return;
    }

    try {
      await navigator.clipboard.writeText(message);
    } catch (error) {
      console.error('クリップボードへのコピーに失敗しました', error);
      return;
    }

    setIsShowsCheck(true);

    if (targetRef?.current) {
      targetRef.current.classList.add('animate-copy-highlight');

      // アニメーション終了後にクラスを削除
      setTimeout(() => {
        targetRef?.current?.classList.remove('animate-copy-highlight');
        setIsShowsCheck(false);
      }, 3000);
    } else {
      setTimeout(() => {
        setIsShowsCheck(false);
      }, 3000);
    }
  };

  return (
    <ButtonIcon
      className={`min-w-[calc(78/16*1rem)] justify-start! gap-x-0.5 text-oln-14N-100! ${className ?? ''}`}
      disabled={disabled}
      onClick={() => {
        copyMessage(text);
      }}
    >
      {isShowsCheck ? (
        <>
          <PiCheck className='mr-1 text-xl' aria-hidden={true} />
          完了
        </>
      ) : (
        <>
          <PiClipboard className='text-xl' aria-hidden={true} />
          コピー
        </>
      )}
    </ButtonIcon>
  );
};
