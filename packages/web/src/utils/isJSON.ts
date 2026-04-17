export const isJSON = (json: string): boolean => {
  if (!json || !json.trim()) {
    return false;
  }

  try {
    const result = JSON.parse(json);
    return typeof result === 'object' && result !== null;
  } catch {
    return false;
  }
};
