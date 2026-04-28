import { PageTitle } from '@/components/PageTitle';
import { APP_TITLE } from '@/constants';
import { useExApps } from '@/features/exapps/hooks/useExApps';
import { ExAppList } from './ExAppList';

export const ExAppsContent = () => {
  const { exAppOptions, setTeamId, setExAppId } = useExApps();

  return (
    <>
      <PageTitle title={`AIアプリ一覧${APP_TITLE ? ` | ${APP_TITLE}` : ''}`} />
      <div className='mx-6 max-w-[calc(1120/16*1rem)] py-6 lg:mx-10 lg:pb-8'>
        <h1 className='mb-4 flex justify-start text-std-20B-160 lg:text-std-24B-150'>
          AIアプリ一覧
        </h1>
        <div>
          <ExAppList exAppOptions={exAppOptions} setTeamId={setTeamId} setExAppId={setExAppId} />
        </div>
      </div>
    </>
  );
};
