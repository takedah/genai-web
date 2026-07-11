import { getAvailableGenuApps } from '@/utils/getAvailableGenuApps';
import { ExAppOptions } from '../types';

export const useGenUApps = () => {
  const genUApps: ExAppOptions[string]['exApps'] = getAvailableGenuApps().map((meta) => ({
    label: meta.label,
    value: meta.kind,
    description: meta.description,
  }));

  return { genUApps };
};
