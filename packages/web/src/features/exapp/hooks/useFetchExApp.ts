import { ExApp } from 'genai-web';
import useSWR from 'swr';
import { teamApiFetcher } from '@/lib/fetcher';

export const useFetchExApp = (teamId: string, exAppId: string) => {
  const { data } = useSWR<ExApp>(`/teams/${teamId}/exapps/${exAppId}`, teamApiFetcher, {
    suspense: true,
  });

  return { data: data! };
};
