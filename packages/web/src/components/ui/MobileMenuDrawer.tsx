import { type ComponentProps, forwardRef } from 'react';
import { CloseIcon, HamburgerMenuButton } from '@/components/ui/dads/HamburgerMenuButton';

type Props = ComponentProps<'dialog'> & {
  onClose: () => void;
};

export const MobileMenuDrawer = forwardRef<HTMLDialogElement, Props>((props, ref) => {
  const { children, onClose, ...rest } = props;

  return (
    <dialog
      className='m-[unset] h-screen max-h-[unset] max-w-full overflow-visible backdrop:bg-opacity-gray-100 open:grid open:grid-rows-[auto_minmax(0,1fr)] lg:hidden! forced-colors:backdrop:bg-[#000b]'
      ref={ref}
      aria-labelledby='mobile-menu-heading'
      {...rest}
    >
      <h2 id='mobile-menu-heading' className='sr-only'>
        メニュー
      </h2>
      <div className='flex h-14 items-center border-r border-r-solid-gray-420 bg-white px-1'>
        <HamburgerMenuButton
          className='px-1 pt-1 pb-1.5'
          aria-controls='main-menu-container'
          onClick={onClose}
        >
          <CloseIcon className='flex-none' />
          閉じる
        </HamburgerMenuButton>
      </div>
      {children}
    </dialog>
  );
});
