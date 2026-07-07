import { genUPublicApi } from '@/lib/fetcher';

type CompletePasswordResetRequest = {
  email: string;
  confirmationCode: string;
  newPassword: string;
  confirmPassword: string;
};

type CompletePasswordResetResponse = {
  message: string;
};

export const useCompletePasswordReset = () => {
  return {
    completePasswordReset: async (
      request: CompletePasswordResetRequest,
    ): Promise<CompletePasswordResetResponse> => {
      const res = await genUPublicApi.post<CompletePasswordResetResponse>(
        'auth/password-reset/complete',
        request,
      );
      return res.data;
    },
  };
};
