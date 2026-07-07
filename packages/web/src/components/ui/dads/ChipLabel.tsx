import type { ComponentProps } from 'react';

export type ChipLabelProps = ComponentProps<'span'>;

export const ChipLabel = (props: ChipLabelProps) => {
  const { children, className, ...rest } = props;

  return (
    <span
      className={`inline-flex min-h-7 items-center justify-center text-nowrap rounded-8 border border-transparent px-2 pb-px text-oln-16N-100 ${className ?? ''}`}
      {...rest}
    >
      {children}
    </span>
  );
};
