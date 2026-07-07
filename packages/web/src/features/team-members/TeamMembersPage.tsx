import { Suspense, useId, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
  ProgressIndicator,
  ProgressIndicatorSpinner,
} from '@/components/ui/dads/ProgressIndicator';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { DialogDeleteTeamMember } from '@/features/team-members/components/DialogDeleteTeamMember';
import { LayoutBody } from '@/layout/LayoutBody';
import { TeamMembersContent } from './components/TeamMembersContent';

export const TeamMembersPage = () => {
  const [showDialogDeleteTeamUser, setShowDialogDeleteTeamUser] = useState(false);
  const [selectedTeamUserId, setSelectedTeamUserId] = useState('');
  const loadingId = useId();

  const reset = () => {
    setSelectedTeamUserId('');
    setShowDialogDeleteTeamUser(false);
  };

  return (
    <LayoutBody>
      <ErrorBoundary fallbackRender={ErrorFallback}>
        <Suspense
          fallback={
            <div className='mx-auto p-6 max-w-(--page-width) lg:p-8'>
              <ProgressIndicator type='inlined' aria-labelledby={loadingId}>
                <ProgressIndicatorSpinner size='sm' />
                <span id={loadingId}>チームを読み込み中...</span>
              </ProgressIndicator>
            </div>
          }
        >
          <TeamMembersContent
            onOpenDeleteModal={(teamUserId: string) => {
              setSelectedTeamUserId(teamUserId);
              setShowDialogDeleteTeamUser(true);
            }}
          />
        </Suspense>
      </ErrorBoundary>

      <DialogDeleteTeamMember
        key={selectedTeamUserId}
        isOpen={showDialogDeleteTeamUser}
        userId={selectedTeamUserId}
        onDeleted={() => reset()}
        onClose={() => reset()}
      />
    </LayoutBody>
  );
};
