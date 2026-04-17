import { GetArtifactFileResponse } from 'genai-web';
import { useCallback } from 'react';
import { teamApi } from '@/lib/fetcher';

export const useGetArtifactFile = () => {
  const getArtifactFileUrl = useCallback(async (s3Url: string): Promise<string> => {
    const params = new URLSearchParams({
      s3Url: encodeURIComponent(s3Url),
    });

    const response = await teamApi.get<GetArtifactFileResponse>(
      `/exapps/artifact-file?${params.toString()}`,
    );

    return response.data.data;
  }, []);

  return {
    getArtifactFileUrl,
  };
};
