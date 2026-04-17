import { CustomSelect } from '@/components/ui/CustomSelect';
import { useSelectedModel } from '@/hooks/useSelectedModel';
import { findModelDisplayNameByModelId, MODELS } from '@/models';

export const ModelSelector = () => {
  const { selectedModelId, setSelectedModelId } = useSelectedModel();
  const { modelIds: availableModels } = MODELS;

  return (
    <div className='mt-2 flex w-full items-end justify-start lg:mt-0 print:hidden'>
      <CustomSelect
        label='LLM：'
        labelClassName='text-dns-14B-120'
        value={selectedModelId}
        onChange={setSelectedModelId}
        options={availableModels.map((m) => {
          return { value: m, label: findModelDisplayNameByModelId(m) };
        })}
      />
    </div>
  );
};
