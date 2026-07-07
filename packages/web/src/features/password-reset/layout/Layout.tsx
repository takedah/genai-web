import type React from 'react';

type Props = {
  children: React.ReactNode;
};

export const Layout = (props: Props) => {
  const { children } = props;

  return (
    <div id='layoutRoot' className='flex min-h-dvh w-screen flex-col'>
      <main id='mainContents' className='flex flex-1 flex-col items-center pb-8'>
        {children}
      </main>
    </div>
  );
};
