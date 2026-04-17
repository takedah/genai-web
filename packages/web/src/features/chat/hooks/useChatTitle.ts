import { useParams } from 'react-router';
import { useChatList } from '@/hooks/useChatList';

export const useChatTitle = () => {
  const { chatId } = useParams();
  const { getChatTitle } = useChatList();

  const title = chatId ? getChatTitle(chatId) || 'チャット' : 'チャット';

  return {
    title,
  };
};
