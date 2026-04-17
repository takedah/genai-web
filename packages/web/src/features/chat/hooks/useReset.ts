import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router';
import { useChat } from '@/hooks/useChat';
import { useShouldResetOnNavigate } from '@/hooks/useShouldResetOnNavigate';

export const useReset = () => {
  const { shouldReset } = useShouldResetOnNavigate();
  const { pathname } = useLocation();
  const { chatId } = useParams();
  const { clear } = useChat(pathname, chatId);

  useEffect(() => {
    if (!shouldReset) {
      return;
    }

    clear();
  }, [shouldReset]);
};
