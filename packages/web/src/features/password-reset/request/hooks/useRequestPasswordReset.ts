import { genUPublicApi } from '@/lib/fetcher';

export const useRequestPasswordReset = () => {
  return {
    requestPasswordReset: async (email: string): Promise<void> => {
      await genUPublicApi.post('auth/password-reset/request', {
        email,
      });
    },
  };
};
