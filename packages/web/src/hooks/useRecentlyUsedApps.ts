import { useCallback } from 'react';
import { z } from 'zod';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GenuAppKind } from '@/utils/getAvailableGenuApps';

const STORAGE_KEY = 'recently_used_apps';
const MAX_ENTRIES = 8;
const STORE_VERSION = 1;
const TITLE_MAX_LENGTH = 200;

export const isRecentlyUsedAppsEnabled =
  import.meta.env.VITE_APP_RECENTLY_USED_APPS_ENABLED === 'true';

const recentlyUsedAppEntrySchema = z.object({
  key: z.string().min(1).max(200),
  kind: z.enum(['exapp', 'genu']),
  title: z.string().min(1).max(TITLE_MAX_LENGTH),
  path: z
    .string()
    .min(1)
    .max(500)
    .refine((p) => p.startsWith('/') && !p.startsWith('//'), {
      message: 'path must be an internal absolute path',
    }),
  usedAt: z.string().datetime(),
});

const persistedStateSchema = z.object({
  entries: z.array(recentlyUsedAppEntrySchema).max(20),
});

export type RecentlyUsedAppEntry = z.infer<typeof recentlyUsedAppEntrySchema>;

export type RecordExAppInput = {
  kind: 'exapp';
  teamId: string;
  exAppId: string;
  title: string;
  path: string;
};

export type RecordGenuInput = {
  kind: 'genu';
  genuKind: GenuAppKind;
  title: string;
  path: string;
};

export type RecordRecentlyUsedAppInput = RecordExAppInput | RecordGenuInput;

const buildKey = (input: RecordRecentlyUsedAppInput): string => {
  if (input.kind === 'exapp') {
    return `exapp:${input.teamId}:${input.exAppId}`;
  }
  return `genu:${input.genuKind}`;
};

type RecentlyUsedAppsState = {
  entries: RecentlyUsedAppEntry[];
  record: (input: RecordRecentlyUsedAppInput) => void;
};

const useRecentlyUsedAppsStore = create<RecentlyUsedAppsState>()(
  persist(
    (set) => ({
      entries: [],
      record: (input) =>
        set((state) => {
          const key = buildKey(input);
          const next: RecentlyUsedAppEntry = {
            key,
            kind: input.kind,
            title: input.title.slice(0, TITLE_MAX_LENGTH),
            path: input.path,
            usedAt: new Date().toISOString(),
          };
          const filtered = state.entries.filter((entry) => entry.key !== key);
          return { entries: [next, ...filtered].slice(0, MAX_ENTRIES) };
        }),
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      partialize: (state) => ({ entries: state.entries }),
      merge: (persisted, current) => {
        const result = persistedStateSchema.safeParse(persisted);
        if (!result.success) {
          return current;
        }
        return { ...current, entries: result.data.entries.slice(0, MAX_ENTRIES) };
      },
    },
  ),
);

export const useRecentlyUsedApps = (): RecentlyUsedAppEntry[] =>
  useRecentlyUsedAppsStore((state) => state.entries);

export const useRecordRecentlyUsedApp = () => {
  const record = useRecentlyUsedAppsStore((state) => state.record);
  return useCallback(
    (input: RecordRecentlyUsedAppInput) => {
      record(input);
    },
    [record],
  );
};
