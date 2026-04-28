import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { Tabs } from '@/components/ui/Tabs';
import { APP_TITLE } from '@/constants';
import { BackButton } from '@/features/team-apps/components/BackButton';
import { useSelectedTeam } from '@/features/team-members/hooks/useSelectedTeam';
import { Loading } from './Loading';
import { TeamMemberCreateButton } from './TeamMemberCreateButton';
import { TeamMemberList } from './TeamMemberList';

type Props = {
  onOpenDeleteModal: (teamUserId: string) => void;
};

export const TeamMembersContent = ({ onOpenDeleteModal }: Props) => {
  const { pageTitle, selectedTeamName } = useSelectedTeam();
  const { teamId } = useParams();

  return (
    <>
      <PageTitle title={`${pageTitle}${APP_TITLE ? ` | ${APP_TITLE}` : ''}`} />
      <div className='mx-6 max-w-[calc(1024/16*1rem)] pt-6 pb-12 lg:mx-10 lg:pb-16'>
        <h1 className='flex justify-start text-std-20B-160 lg:text-std-24B-150'>
          {selectedTeamName}
          <span className='sr-only'>（メンバー）</span>
        </h1>
        <div className='mt-2'>
          <BackButton />
        </div>

        <Tabs
          title='チーム詳細'
          items={[
            {
              title: 'AIアプリ',
              href: `/teams/${teamId}/apps`,
              selected: false,
            },
            {
              title: 'メンバー',
              href: `/teams/${teamId}/members`,
              selected: true,
            },
          ]}
        />

        <TeamMemberCreateButton />

        <ErrorBoundary fallbackRender={ErrorFallback}>
          <Suspense fallback={<Loading />}>
            <TeamMemberList handleOpenDeleteModal={onOpenDeleteModal} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </>
  );
};
