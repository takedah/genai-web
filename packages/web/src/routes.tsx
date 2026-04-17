import type { HiddenUseCasesKeys } from 'genai-web';
import type { RouteObject } from 'react-router';
import { ChatPage } from '@/features/chat/ChatPage';
import { ChatHistoryPage } from '@/features/chat-history/ChatHistoryPage';
import { ExAppPage } from '@/features/exapp/ExAppPage';
import { ExAppsPage } from '@/features/exapps/ExAppsPage';
import { GenerateDiagramPage } from '@/features/generate-diagram/GenerateDiagramPage';
import { GenerateImagePage } from '@/features/generate-image/GenerateImagePage';
import { GenerateTextPage } from '@/features/generate-text/GenerateTextPage';
import { LandingPage } from '@/features/landing/LandingPage';
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
import { TranscribePage } from '@/features/transcribe/TranscribePage';
import { TranslatePage } from '@/features/translate/TranslatePage';
import { NotFound } from '@/NotFound';
import { ApiRequestDataFormatPage } from '@/pages/ApiRequestDataFormat';
import { Layout } from './layout/Layout';
import { DietAnswerDraftingAiSkillsPage } from './pages/DietAnswerDraftingAiSkillsPage';
import { SignedOutPage } from './pages/SignedOutPage';

type EnabledFn = (...useCases: HiddenUseCasesKeys[]) => boolean;

export const createRoutes = (enabled: EnabledFn): RouteObject[] => {
  return [
    {
      path: '/signed-out',
      element: <SignedOutPage />,
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
        {
          path: 'chat',
          element: <ChatPage />,
        },
        {
          path: 'chat/:chatId',
          element: <ChatPage />,
        },
        { path: 'history', element: <ChatHistoryPage /> },
        enabled('generate') ? { path: 'generate', element: <GenerateTextPage /> } : null,
        enabled('translate') ? { path: 'translate', element: <TranslatePage /> } : null,
        enabled('image') ? { path: 'image', element: <GenerateImagePage /> } : null,
        enabled('diagram') ? { path: 'diagram', element: <GenerateDiagramPage /> } : null,
        { path: 'transcribe', element: <TranscribePage /> },
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
        {
          path: 'skillsets/diet-answer-drafting',
          element: <DietAnswerDraftingAiSkillsPage />,
        },
        { path: '*', element: <NotFound /> },
      ].flatMap((r) => (r ? [r] : [])),
    },
  ].flatMap((r) => (r ? [r] : []));
};
