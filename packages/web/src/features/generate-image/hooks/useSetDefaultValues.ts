import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useChat } from '@/hooks/useChat';
import { MODELS, resolveDefaultModelId } from '@/models';
import { useGenerateImageStore } from '../stores/useGenerateImageStore';
import { GenerateImagePageQueryParams } from '../types';

export const useSetDefaultValues = () => {
  const { pathname, search } = useLocation();
  const { imageGenModelId, setChatContent, setImageGenModelId } = useGenerateImageStore();
  const { getModelId, setModelId } = useChat(pathname);
  const { modelIds, imageGenModelIds } = MODELS;

  const modelId = getModelId();

  useEffect(() => {
    const defaultModelId = !modelId ? resolveDefaultModelId() : modelId;
    const defaultImageGenModelId = !imageGenModelId ? imageGenModelIds[0] : imageGenModelId;

    if (search !== '') {
      const params = Object.fromEntries(
        new URLSearchParams(search),
      ) as GenerateImagePageQueryParams;

      setChatContent(params.content ?? '');

      setModelId(modelIds.includes(params.modelId ?? '') ? params.modelId! : defaultModelId);

      setImageGenModelId(
        imageGenModelIds.includes(params.imageModelId ?? '')
          ? params.imageModelId!
          : defaultImageGenModelId,
      );
    } else {
      setModelId(defaultModelId);
      setImageGenModelId(defaultImageGenModelId);
    }
  }, [search]);
};
