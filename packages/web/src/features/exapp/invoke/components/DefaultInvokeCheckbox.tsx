import { Checkbox } from '@/components/ui/dads/Checkbox';
import { useDefaultInvokeSetting } from '@/hooks/useDefaultInvokeSetting';

type Props = {
  storageKey: string;
};

export const DefaultInvokeCheckbox = ({ storageKey }: Props) => {
  const [isDefault, setIsDefault] = useDefaultInvokeSetting(storageKey);

  return (
    <Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}>
      アプリを開いたとき、「概要・注意事項」をスキップして「アプリ実行」を表示する
    </Checkbox>
  );
};
