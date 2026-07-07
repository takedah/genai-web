import { InvokeExAppHistory } from 'genai-web';
import { ChipLabel } from '@/components/ui/dads/ChipLabel';

type Props = {
  status: InvokeExAppHistory['status'];
};

const commonStatusLabelClassName = 'min-w-16 px-0!';
export const ExAppInvokeHistoryItemStatusLabel = (props: Props) => {
  const { status } = props;
  switch (status) {
    case 'ACCEPTED':
      return (
        <ChipLabel
          className={`${commonStatusLabelClassName} border-lime-1000! bg-lime-50 text-lime-1000`}
        >
          <span className='sr-only'>ステータス：</span>受付済
        </ChipLabel>
      );
    case 'IN_PROGRESS':
      return (
        <ChipLabel
          className={`${commonStatusLabelClassName} border-light-blue-800! bg-light-blue-800 text-white`}
        >
          <span className='sr-only'>ステータス：</span>処理中
        </ChipLabel>
      );
    case 'COMPLETED':
      return (
        <ChipLabel
          className={`${commonStatusLabelClassName} border-lime-900! bg-lime-900 text-white`}
        >
          <span className='sr-only'>ステータス：</span>完了
        </ChipLabel>
      );
    case 'ERROR':
      return (
        <ChipLabel className={`${commonStatusLabelClassName} border-error-2 bg-error-2 text-white`}>
          <span className='sr-only'>ステータス：</span>エラー
        </ChipLabel>
      );
    default:
      return;
  }
};
