import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'default_invoke_apps';

const parseApps = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * GenU アプリ用: useDefaultInvokeSetting('generate')
 * ExApp 用: useDefaultInvokeSetting('exapp_xxx')
 */
export const useDefaultInvokeSetting = (key: string) => {
  const [raw, setRaw] = useLocalStorage(STORAGE_KEY, '[]');
  const apps = parseApps(raw);
  const isDefault = apps.includes(key);

  const setIsDefault = useCallback(
    (value: boolean) => {
      const current = parseApps(localStorage.getItem(STORAGE_KEY) ?? '[]');
      const next = value ? [...new Set([...current, key])] : current.filter((k) => k !== key);
      setRaw(JSON.stringify(next));
    },
    [key, setRaw],
  );

  return [isDefault, setIsDefault] as const;
};
