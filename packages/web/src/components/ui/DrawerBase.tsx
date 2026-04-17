import type { ReactNode } from 'react';

type Props = {
  className?: string;
  children: ReactNode;
};

export const DrawerBase = (props: Props) => {
  const { className, children } = props;
  return (
    <div
      className={`flex h-full w-72 flex-col justify-between border-r border-r-solid-gray-420 bg-white text-std-16N-170 text-solid-gray-800 print:hidden ${className ?? ''}`}
    >
      <nav
        aria-labelledby='side-menu-heading'
        className='flex h-full flex-col overflow-x-clip overflow-y-auto pt-1 pb-4 [scrollbar-gutter:stable]'
      >
        <h2 id='side-menu-heading' className='sr-only'>
          メインメニュー
        </h2>
        {children}
      </nav>
    </div>
  );
};
