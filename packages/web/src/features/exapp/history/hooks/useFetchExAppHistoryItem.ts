import { GetInvokeExAppHistoryResponse } from 'genai-web';
import useSWR from 'swr';
import { teamApiFetcher } from '@/lib/fetcher';

export const useFetchExAppHistoryItem = (teamId: string, exAppId: string, createdDate: string) => {
  const params = new URLSearchParams({ teamId, exAppId, createdDate });

  const { data, mutate } = useSWR<GetInvokeExAppHistoryResponse>(
    `exapps/history?${params.toString()}`,
    teamApiFetcher,
    { revalidateOnFocus: false, suspense: true },
  );

  return { data: data!, mutate };
};
