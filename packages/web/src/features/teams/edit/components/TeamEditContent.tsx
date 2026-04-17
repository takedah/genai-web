import { PageTitle } from '@/components/PageTitle';
import { APP_TITLE } from '@/constants';
import { usePageTitle } from '../hooks/usePageTitle';
import { BackButton } from './BackButton';
import { TeamEditForm } from './TeamEditForm';

export const TeamEditContent = () => {
  const PAGE_TITLE = 'チーム名の変更';
  const { pageTitle } = usePageTitle();

  return (
    <>
      <PageTitle title={`${pageTitle} | ${APP_TITLE}`} />
      <div className='mx-6 max-w-[calc(928/16*1rem)] py-6 lg:mx-10 lg:pb-8'>
        <h1 className='flex justify-start text-std-20B-160 lg:text-std-24B-150'>{PAGE_TITLE}</h1>

        <div className='mt-2 mb-6'>
          <BackButton />
        </div>

        <TeamEditForm />
      </div>
    </>
  );
};
