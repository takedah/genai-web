import { Link, useParams } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { Button } from '@/components/ui/dads/Button';
import { APP_TITLE } from '@/constants';
import { useFetchExApp } from '../hooks/useFetchExApp';
import { ExAppHeader } from './ExAppHeader';
import { ExAppUsageMarkdownRenderer } from './ExAppUsageMarkdownRenderer';

export const ExAppPageContent = () => {
  const { teamId = '', exAppId = '' } = useParams<{ teamId: string; exAppId: string }>();
  const { data: exApp } = useFetchExApp(teamId, exAppId);

  return (
    <>
      <PageTitle title={`${exApp.exAppName}（概要・注意事項） | ${APP_TITLE}`} />
      <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
        <ExAppHeader exApp={exApp} teamId={teamId} exAppId={exAppId} />
        <div className='py-4 lg:py-6'>
          {exApp.howToUse && <ExAppUsageMarkdownRenderer content={exApp.howToUse} size='sm' />}
          <div className='text-center mt-8'>
            <Button variant='outline' size='lg' asChild>
              <Link to={`/apps/${teamId}/${exAppId}/invoke`}>このアプリを使う</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
