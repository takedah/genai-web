import type { RouteObject } from 'react-router';
import { ChatPage } from '@/features/chat/ChatPage';
import { ChatHistoryPage } from '@/features/chat-history/ChatHistoryPage';
import { ExAppPage } from '@/features/exapp/ExAppPage';
import { ExAppHistoryPage } from '@/features/exapp/history/ExAppHistoryPage';
import { ExAppInvokePage } from '@/features/exapp/invoke/ExAppInvokePage';
import { ExAppsPage } from '@/features/exapps/ExAppsPage';
import { GenerateDiagramPage } from '@/features/generate-diagram/GenerateDiagramPage';
import { GenerateDiagramInvokePage } from '@/features/generate-diagram/invoke/GenerateDiagramInvokePage';
import { GenerateImagePage } from '@/features/generate-image/GenerateImagePage';
import { GenerateTextPage } from '@/features/generate-text/GenerateTextPage';
import { GenerateTextInvokePage } from '@/features/generate-text/invoke/GenerateTextInvokePage';
import { LandingPage } from '@/features/landing/LandingPage';
import { PasswordResetCompletePage } from '@/features/password-reset/complete/PasswordResetCompletePage';
import {
  isCustomPasswordResetEnabled,
  PASSWORD_RESET_COMPLETE_PATH,
  PASSWORD_RESET_REQUEST_PATH,
} from '@/features/password-reset/constants';
import { PasswordResetRequestPage } from '@/features/password-reset/request/PasswordResetRequestPage';
import { TeamAppCopyPage } from '@/features/team-apps/copy/TeamAppCopyPage';
import { TeamAppCreatePage } from '@/features/team-apps/create/TeamAppCreatePage';
import { TeamAppEditPage } from '@/features/team-apps/edit/TeamAppEditPage';
import { TeamAppsPage } from '@/features/team-apps/TeamAppsPage';
import { TeamMemberCreatePage } from '@/features/team-members/create/TeamMemberCreatePage';
import { TeamMemberEditPage } from '@/features/team-members/edit/TeamMemberEditPage';
import { TeamMembersPage } from '@/features/team-members/TeamMembersPage';
import { TeamCreatePage } from '@/features/teams/create/TeamCreatePage';
import { TeamEditPage } from '@/features/teams/edit/TeamEditPage';
import { TeamsPage } from '@/features/teams/TeamsPage';
import { TranscribeInvokePage } from '@/features/transcribe/invoke/TranscribeInvokePage';
import { TranscribePage } from '@/features/transcribe/TranscribePage';
import { TranslateInvokePage } from '@/features/translate/invoke/TranslateInvokePage';
import { TranslatePage } from '@/features/translate/TranslatePage';
import { NotFound } from '@/NotFound';
import { ApiRequestDataFormatPage } from '@/pages/ApiRequestDataFormat';
import { isUseCaseEnabled } from '@/utils/isUseCaseEnabled';
import { Layout } from './layout/Layout';
import { AuthErrorPage } from './pages/AuthErrorPage';
import { SignedOutPage } from './pages/SignedOutPage';

const emailMfaRequired: boolean = import.meta.env.VITE_APP_EMAIL_MFA_REQUIRED === 'true';
const samlAuthEnabled: boolean = import.meta.env.VITE_APP_SAMLAUTH_ENABLED === 'true';
const customPasswordResetEnabled = isCustomPasswordResetEnabled(emailMfaRequired, samlAuthEnabled);

export const createRoutes = (): RouteObject[] => {
  return [
    ...(customPasswordResetEnabled
      ? [
          {
            path: PASSWORD_RESET_REQUEST_PATH,
            element: <PasswordResetRequestPage />,
          },
          {
            path: PASSWORD_RESET_COMPLETE_PATH,
            element: <PasswordResetCompletePage />,
          },
        ]
      : []),
    {
      path: '/signed-out',
      element: <SignedOutPage />,
    },
    {
      path: '/auth-error',
      element: <AuthErrorPage />,
    },
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <LandingPage /> },
        {
          path: 'apps',
          element: <ExAppsPage />,
        },
        { path: 'apps/:teamId/:exAppId', element: <ExAppPage /> },
        { path: 'apps/:teamId/:exAppId/invoke', element: <ExAppInvokePage /> },
        { path: 'apps/:teamId/:exAppId/invoke/:createdDate', element: <ExAppHistoryPage /> },
        {
          path: 'chat',
          element: <ChatPage />,
        },
        {
          path: 'chat/:chatId',
          element: <ChatPage />,
        },
        { path: 'history', element: <ChatHistoryPage /> },
        isUseCaseEnabled('generate') ? { path: 'generate', element: <GenerateTextPage /> } : null,
        isUseCaseEnabled('generate')
          ? { path: 'generate/invoke', element: <GenerateTextInvokePage /> }
          : null,
        isUseCaseEnabled('translate') ? { path: 'translate', element: <TranslatePage /> } : null,
        isUseCaseEnabled('translate')
          ? { path: 'translate/invoke', element: <TranslateInvokePage /> }
          : null,
        isUseCaseEnabled('image') ? { path: 'image', element: <GenerateImagePage /> } : null,
        isUseCaseEnabled('diagram') ? { path: 'diagram', element: <GenerateDiagramPage /> } : null,
        isUseCaseEnabled('diagram')
          ? { path: 'diagram/invoke', element: <GenerateDiagramInvokePage /> }
          : null,
        { path: 'transcribe', element: <TranscribePage /> },
        { path: 'transcribe/invoke', element: <TranscribeInvokePage /> },
        { path: 'teams', element: <TeamsPage /> },
        { path: 'teams/create', element: <TeamCreatePage /> },
        {
          path: 'teams/:teamId/edit',
          element: <TeamEditPage />,
        },
        {
          path: 'teams/:teamId/members',
          element: <TeamMembersPage />,
        },
        {
          path: 'teams/:teamId/members/create',
          element: <TeamMemberCreatePage />,
        },
        {
          path: 'teams/:teamId/members/:userId/edit',
          element: <TeamMemberEditPage />,
        },
        {
          path: 'teams/:teamId/apps',
          element: <TeamAppsPage />,
        },
        {
          path: 'teams/:teamId/apps/create',
          element: <TeamAppCreatePage />,
        },
        {
          path: 'teams/:teamId/apps/:appId/edit',
          element: <TeamAppEditPage />,
        },
        {
          path: 'teams/:teamId/apps/:appId/copy',
          element: <TeamAppCopyPage />,
        },
        { path: 'docs/api-request-data-format', element: <ApiRequestDataFormatPage /> },
        { path: '*', element: <NotFound /> },
      ].flatMap((r) => (r ? [r] : [])),
    },
  ].flatMap((r) => (r ? [r] : []));
};
