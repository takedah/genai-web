import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router';
import { FILE_LIMIT } from '@/features/chat/constants';
import { useChat } from '@/hooks/useChat';
import { MODELS } from '@/models';

export const useFileUploadable = () => {
  const { chatId } = useParams();
  const { pathname } = useLocation();

  const { getModelId } = useChat(pathname, chatId);

  const modelId = getModelId();

  const accept = useMemo(() => {
    if (!modelId) {
      return [];
    }

    const feature = MODELS.modelMetadata[modelId].flags;
    return [
      ...(feature.doc ? FILE_LIMIT.accept.doc : []),
      ...(feature.image ? FILE_LIMIT.accept.image : []),
      ...(feature.video ? FILE_LIMIT.accept.video : []),
    ];
  }, [modelId]);

  const fileUploadable = accept.length > 0;

  return {
    accept,
    fileUploadable,
  };
};
