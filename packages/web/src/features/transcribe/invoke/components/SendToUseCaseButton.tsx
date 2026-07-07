import { Button } from '@/components/ui/dads/Button';
import { useTranscribeStore } from '../stores/useTranscribeStore';

type Props = {
  className?: string;
  formattedOutput: string;
  disabled?: boolean;
};

export const SendToUseCaseButton = (props: Props) => {
  const { className, formattedOutput, disabled } = props;

  const { setShowModal } = useTranscribeStore();

  const handleSendClick = () => {
    if (formattedOutput === '') {
      return;
    }
    setShowModal(true);
  };

  return (
    <Button
      size='md'
      variant='outline'
      aria-disabled={disabled}
      className={`${className ?? ''}`}
      onClick={handleSendClick}
    >
      音声認識結果を他のユースケースで使う
    </Button>
  );
};
