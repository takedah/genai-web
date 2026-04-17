import { PiCaretLeft } from 'react-icons/pi';
import { Link } from 'react-router';
import { Button } from '@/components/ui/dads/Button';

export const BackButton = () => {
  return (
    <Button className='-ml-1 inline-flex items-center gap-1 px-1!' variant='text' size='sm' asChild>
      <Link to='/teams'>
        <PiCaretLeft />
        チーム管理に戻る
      </Link>
    </Button>
  );
};
