import { PageTitle } from '@/components/PageTitle';
import { APP_TITLE } from '@/constants';
import { useFetchTeamApp } from '../../hooks/useFetchTeamApp';
import { useSelectedTeam } from '../hooks/useSelectedTeam';
import { BackButton } from './BackButton';
import { TeamAppEditForm } from './TeamAppEditForm';

export const TeamAppEditContent = () => {
  const PAGE_TITLE = 'AIアプリの編集';

  const { app } = useFetchTeamApp({ suspense: true });
  const { pageTitle, selectedTeamName } = useSelectedTeam();

  return (
    <>
      <PageTitle title={`${pageTitle} | ${APP_TITLE}`} />
      <div className='mx-6 max-w-[calc(1024/16*1rem)] py-6 lg:mx-10 lg:pb-8'>
        <h1 className='flex justify-start text-std-20B-160 lg:text-std-24B-150'>{PAGE_TITLE}</h1>

        <div className='mt-2 mb-6'>
          <BackButton teamName={selectedTeamName} />
        </div>

        {app && <TeamAppEditForm app={app} />}
      </div>
    </>
  );
};
