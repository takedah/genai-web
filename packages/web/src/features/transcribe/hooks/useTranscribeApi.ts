import {
  GetFileUploadSignedUrlRequest,
  GetFileUploadSignedUrlResponse,
  GetTranscriptionResponse,
  StartTranscriptionRequest,
  StartTranscriptionResponse,
  UploadAudioRequest,
} from 'genai-web';
import useSWR from 'swr';
import { genUApi, genUApiFetcher, uploadToSignedUrl } from '@/lib/fetcher';

export const useTranscribeApi = () => {
  return {
    getSignedUrl: (req: GetFileUploadSignedUrlRequest) => {
      return genUApi.post<GetFileUploadSignedUrlResponse>('transcribe/url', req);
    },
    getTranscription: (
      jobName: string | null,
      status: string,
      setStatus: (status: string) => void,
    ) => {
      return useSWR<GetTranscriptionResponse>(
        jobName ? `transcribe/result/${jobName}` : null,
        genUApiFetcher,
        {
          refreshInterval: status === 'COMPLETED' ? 0 : 2000,
          onSuccess: (data: GetTranscriptionResponse) => {
            setStatus(data.status);
          },
        },
      );
    },
    startTranscription: async (req: StartTranscriptionRequest) => {
      const res = await genUApi.post<StartTranscriptionResponse>('transcribe/start', req);
      return res.data;
    },
    uploadAudio: (url: string, req: UploadAudioRequest) => {
      return uploadToSignedUrl(url, req.file, 'audio/*');
    },
  };
};
