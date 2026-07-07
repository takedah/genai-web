const STORAGE_KEY = 'default_invoke_apps';
const DEFAULT_INVOKE_TARGETS = new Set(['generate', 'translate', 'diagram', 'transcribe']);

const isDefaultInvoke = (key: string): boolean => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) && parsed.includes(key);
  } catch {
    return false;
  }
};

export const useResolveAppPath = () => {
  const resolveGenUAppPath = (value: string): string => {
    if (!DEFAULT_INVOKE_TARGETS.has(value)) {
      return `/${value}`;
    }
    return isDefaultInvoke(value) ? `/${value}/invoke` : `/${value}`;
  };

  const resolveExAppPath = (teamId: string, exAppId: string): string => {
    const basePath = `/apps/${teamId}/${exAppId}`;
    return isDefaultInvoke(`exapp_${exAppId}`) ? `${basePath}/invoke` : basePath;
  };

  return { resolveGenUAppPath, resolveExAppPath };
};
