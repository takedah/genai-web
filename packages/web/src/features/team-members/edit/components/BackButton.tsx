import { PiCaretLeft } from 'react-icons/pi';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/dads/Button';

type Props = {
  teamName: string;
};

export const BackButton = (props: Props) => {
  const { teamName } = props;
  const { teamId } = useParams();

  return (
    <Button className='-ml-1 inline-flex items-center gap-1 px-1!' variant='text' size='sm' asChild>
      <Link to={`/teams/${teamId}/members`}>
        <PiCaretLeft />
        {teamName}（メンバー）に戻る
      </Link>
    </Button>
  );
};
