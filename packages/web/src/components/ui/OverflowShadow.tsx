import { type ReactNode, useEffect, useRef, useState } from 'react';

const shadowBaseClass =
  'absolute top-0 h-full w-6 pointer-events-none transition-opacity duration-300';

export const OverflowShadow = ({ children }: { children: ReactNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasRightShadow, setHasRightShadow] = useState(false);
  const [hasLeftShadow, setHasLeftShadow] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateShadows = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setHasRightShadow(scrollLeft + clientWidth < scrollWidth);
      setHasLeftShadow(scrollLeft > 0);
    };

    // コンテナのスクロールに加え、ストリーミング等で中身が後から横に広がる場合も
    // 検知できるよう、コンテナと中身の両方のサイズ変化を監視する
    const resizeObserver = new ResizeObserver(updateShadows);
    resizeObserver.observe(container);
    if (container.firstElementChild) {
      resizeObserver.observe(container.firstElementChild);
    }

    container.addEventListener('scroll', updateShadows);
    updateShadows();
    return () => {
      container.removeEventListener('scroll', updateShadows);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className='relative'>
      <div
        className={`${shadowBaseClass} left-0 bg-gradient-to-r from-black/40 to-transparent ${
          hasLeftShadow ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`${shadowBaseClass} right-0 bg-gradient-to-l from-black/40 to-transparent ${
          hasRightShadow ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div className='overflow-x-auto' ref={containerRef}>
        {children}
      </div>
    </div>
  );
};
