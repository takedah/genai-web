import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { ReactNode, useCallback, useEffect } from 'react';
import { CloseIcon, HamburgerMenuButton } from '@/components/ui/dads/HamburgerMenuButton';

type CustomDialogHeaderProps = {
  className?: string;
  children: ReactNode;
  hasClose?: boolean;
  onClose?: () => void;
};

export const CustomDialogHeader = (props: CustomDialogHeaderProps) => {
  const { className, children, hasClose, onClose } = props;

  const handleExplicitClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <div
      className={`flex items-center justify-between gap-2 border-b border-b-solid-gray-420 pb-2 ${className ?? ''}`}
    >
      <DialogTitle as='h2' className='flex gap-4 text-std-24B-150'>
        {children}
      </DialogTitle>
      {hasClose && (
        <HamburgerMenuButton className='p-1' onClick={handleExplicitClose}>
          <CloseIcon className='flex-none' />
          閉じる
        </HamburgerMenuButton>
      )}
    </div>
  );
};

type CustomDialogBodyProps = {
  className?: string;
  children: ReactNode;
};

export const CustomDialogBody = (props: CustomDialogBodyProps) => {
  const { className, children } = props;

  return <div className={`mt-4 ${className ?? ''}`}>{children}</div>;
};

type CustomDialogPanelProps = {
  className?: string;
  children: ReactNode;
};

export const CustomDialogPanel = (props: CustomDialogPanelProps) => {
  const { className, children } = props;

  return (
    <DialogPanel
      className={`w-full max-w-2xl rounded-8 border border-transparent bg-white p-6 text-left align-middle shadow-xl ${className ?? ''}`}
    >
      {children}
    </DialogPanel>
  );
};

type CustomDialogProps = {
  className?: string;
  isOpen: boolean;
  position?: 'top' | 'center';
  children: ReactNode;
  onClose?: () => void;
};

export const CustomDialog = (props: CustomDialogProps) => {
  const { className, isOpen, position = 'center', children, onClose } = props;

  // NOTE: onClose を無効にしているので、ESC キーで閉じる挙動を自前実装
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // NOTE: Headless UI がデフォルトで Light Dismiss なので、それを無効にするため
  const disableLightDismiss = useCallback(() => {}, []);

  return (
    <Dialog
      open={isOpen}
      className={`${className ?? ''} relative z-50`}
      onClose={disableLightDismiss}
    >
      <DialogBackdrop className='fixed inset-0 bg-black/30 forced-colors:bg-[#000b]' />

      <div className='fixed inset-0 overflow-y-auto [scrollbar-gutter:stable]'>
        <div
          className={`flex min-h-full justify-center p-4 text-center ${position === 'top' ? 'items-start pt-10 lg:pt-20' : 'items-center'}`}
        >
          {children}
        </div>
      </div>
    </Dialog>
  );
};
