import { CustomSelect } from '@/components/ui/CustomSelect';
import { useSelectedModel } from '@/hooks/useSelectedModel';
import { findModelDescriptionByModelId, findModelDisplayNameByModelId, MODELS } from '@/models';

export const ModelSelector = () => {
  const { selectedModelId, setSelectedModelId } = useSelectedModel();
  const { modelIds } = MODELS;

  return (
    <CustomSelect
      label='AIモデル：'
      buttonClassName='min-w-[calc(196/16*1rem)]'
      value={selectedModelId}
      onChange={setSelectedModelId}
      options={modelIds.map((m) => ({
        value: m,
        label: findModelDisplayNameByModelId(m),
        description: findModelDescriptionByModelId(m),
      }))}
    />
  );
};
