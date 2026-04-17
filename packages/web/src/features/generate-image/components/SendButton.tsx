import type React from 'react';
import { ComponentProps } from 'react';
import { PiPaperPlaneRightFill, PiSpinnerGap } from 'react-icons/pi';
import { Button } from '@/components/ui/dads/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';

type Props = {
  className?: string;
  type?: ComponentProps<'button'>['type'];
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
};

const handleDisabled = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
  e.preventDefault();
};

export const SendButton = (props: Props) => {
  const { className, type, disabled, loading, onClick, icon } = props;
  return (
    <div className={`${className ?? ''}`}>
      <Tooltip offset={8}>
        <TooltipTrigger asChild>
          <Button
            type={type}
            variant='solid-fill'
            size='sm'
            className='inline-flex size-11! min-w-0! items-center justify-center p-0!'
            onClick={disabled || loading ? handleDisabled : onClick}
            aria-disabled={disabled || loading}
          >
            {loading ? (
              <PiSpinnerGap className='animate-spin' />
            ) : icon ? (
              icon
            ) : (
              <PiPaperPlaneRightFill aria-label='送信' />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent aria-hidden={true}>送信</TooltipContent>
      </Tooltip>
    </div>
  );
};
