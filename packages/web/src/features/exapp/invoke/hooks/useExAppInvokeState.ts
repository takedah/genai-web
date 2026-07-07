import type { InvokeExAppRequest } from 'genai-web';
import { isRecentlyUsedAppsEnabled, useRecordRecentlyUsedApp } from '@/hooks/useRecentlyUsedApps';
import { isApiError } from '@/lib/fetcher';
import { useExAppInvokeStore } from '../stores/useExAppInvokeStore';
import { useInvokeExApp } from './useInvokeExApp';

type Args = {
  teamId: string;
  exAppId: string;
  exAppName: string;
};

export const useExAppInvokeState = (args: Args) => {
  const { invokeExApp } = useInvokeExApp();
  const store = useExAppInvokeStore();
  const recordRecentlyUsedApp = useRecordRecentlyUsedApp();

  const invokeRequest = async (req: InvokeExAppRequest) => {
    try {
      const res = await invokeExApp(req);
      store.setExAppResponse(res);
      if (isRecentlyUsedAppsEnabled) {
        recordRecentlyUsedApp({
          kind: 'exapp',
          teamId: args.teamId,
          exAppId: args.exAppId,
          title: args.exAppName,
          path: `/apps/${args.teamId}/${args.exAppId}`,
        });
      }
    } catch (error: unknown) {
      store.setExAppResponse(null);
      if (isApiError(error)) {
        throw new Error((error.data as { outputs?: string })?.outputs);
      } else if (error instanceof Error) {
        throw new Error(error.message);
      }
    }
  };

  return {
    ...store,
    invokeRequest,
  };
};
