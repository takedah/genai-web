import { useSessionStorage } from '@/hooks/useSessionStorage';
import { MODELS, resolveDefaultModelId } from '@/models';

export const useSelectedModel = () => {
  const [modelId, setModelId] = useSessionStorage('modelId', '');
  const { modelIds: availableModels } = MODELS;

  const hasModelId = availableModels.includes(modelId);

  return {
    selectedModelId: hasModelId && modelId.length !== 0 ? modelId : resolveDefaultModelId(),
    setSelectedModelId: (id: string) => {
      setModelId(id);
    },
  };
};
