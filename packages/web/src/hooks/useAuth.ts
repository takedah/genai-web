import { fetchAuthSession } from 'aws-amplify/auth';
import useSWR from 'swr';

export const useAuth = () => {
  return useSWR('user', () => {
    return fetchAuthSession();
  });
};
