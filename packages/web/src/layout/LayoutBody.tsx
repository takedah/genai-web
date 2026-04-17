import type React from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useScreen } from '@/hooks/useScreen';

type Props = {
  children: React.ReactNode;
};

// メインコンテンツ全体がスクロール可能なレイアウト用コンポーネント
// チャットページ、画像生成ページ以外で使用
export const LayoutBody = (props: Props) => {
  const { children } = props;
  const { pathname } = useLocation();
  const { screen, scrollTopAnchorRef, scrollBottomAnchorRef } = useScreen();

  useEffect(() => {
    // ページ遷移時にスクロールをトップに移動
    const resetScrollPosition = async () => {
      if (screen.current) {
        screen.current.scrollTo(0, 0);
      }
    };
    resetScrollPosition();
  }, [pathname]);

  return (
    <div className='h-full overflow-x-clip overflow-y-auto [scrollbar-gutter:stable]' ref={screen}>
      <div ref={scrollTopAnchorRef} />
      <div>{children}</div>
      <div ref={scrollBottomAnchorRef} />
    </div>
  );
};
