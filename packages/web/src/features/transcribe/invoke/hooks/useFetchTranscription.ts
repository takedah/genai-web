import type { GetTranscriptionResponse } from 'genai-web';
import useSWR from 'swr';
import { isRecentlyUsedAppsEnabled, useRecordRecentlyUsedApp } from '@/hooks/useRecentlyUsedApps';
import { useResolveAppPath } from '@/hooks/useResolveAppPath';
import { genUApiFetcher, isApiError } from '@/lib/fetcher';
import { GENU_APP_METAS } from '@/utils/getAvailableGenuApps';
import { useTranscribeStore } from '../stores/useTranscribeStore';

export const useFetchTranscription = () => {
  const { jobName, status, setStatus } = useTranscribeStore();
  const recordRecentlyUsedApp = useRecordRecentlyUsedApp();
  const { resolveGenUAppPath } = useResolveAppPath();

  const { data, isLoading, error } = useSWR<GetTranscriptionResponse>(
    jobName ? `transcribe/result/${jobName}` : null,
    genUApiFetcher,
    {
      refreshInterval: status === 'COMPLETED' ? 0 : 2000,
      onSuccess: (data) => {
        const isFirstCompleted = status !== 'COMPLETED' && data.status === 'COMPLETED';
        setStatus(data.status);
        if (isRecentlyUsedAppsEnabled && isFirstCompleted) {
          const meta = GENU_APP_METAS.transcribe;
          recordRecentlyUsedApp({
            kind: 'genu',
            genuKind: 'transcribe',
            title: meta.label,
            path: resolveGenUAppPath('transcribe'),
          });
        }
      },
    },
  );

  return {
    transcriptData: data,
    isLoading,
    error:
      error && isApiError(error)
        ? (error.data as { error?: string })?.error
        : error
          ? JSON.stringify(error)
          : undefined,
  };
};
