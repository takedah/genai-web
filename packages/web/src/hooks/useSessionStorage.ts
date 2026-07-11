import { useCallback, useState } from 'react';

export const useSessionStorage = (key: string, defaultValue: string) => {
  const [value, setValue] = useState(() => sessionStorage.getItem(key) ?? defaultValue);

  const setValueWrapper = useCallback(
    (value: string) => {
      sessionStorage.setItem(key, value);
      setValue(value);
    },
    [key],
  );

  return [value, setValueWrapper] as const;
};
