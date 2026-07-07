import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'recently_used_apps';

const exappInput = (
  overrides: Partial<{ teamId: string; exAppId: string; title: string }> = {},
) => ({
  kind: 'exapp' as const,
  teamId: overrides.teamId ?? 'team-a',
  exAppId: overrides.exAppId ?? 'app-1',
  title: overrides.title ?? 'ExApp 1',
  path: '/apps/team-a/app-1',
});

const genuInput = (genuKind: 'chat' | 'generate' = 'chat') => ({
  kind: 'genu' as const,
  genuKind,
  title: genuKind === 'chat' ? 'チャット' : '文章を生成',
  path: `/${genuKind}`,
});

// 各テストで store のモジュールを再評価して state をリセットする
const importHooks = async () => {
  vi.resetModules();
  return await import('@/hooks/useRecentlyUsedApps');
};

describe('useRecentlyUsedApps / useRecordRecentlyUsedApp', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('初期状態で空配列を返す', async () => {
    const { useRecentlyUsedApps } = await importHooks();
    const { result } = renderHook(() => useRecentlyUsedApps());
    expect(result.current).toEqual([]);
  });

  it('record で 1 件追加すると entries に反映される', async () => {
    const { useRecentlyUsedApps, useRecordRecentlyUsedApp } = await importHooks();
    const { result } = renderHook(() => ({
      entries: useRecentlyUsedApps(),
      record: useRecordRecentlyUsedApp(),
    }));

    act(() => {
      result.current.record(exappInput());
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].key).toBe('exapp:team-a:app-1');
    expect(result.current.entries[0].kind).toBe('exapp');
    expect(result.current.entries[0].title).toBe('ExApp 1');
    expect(result.current.entries[0].path).toBe('/apps/team-a/app-1');
    expect(result.current.entries[0].usedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('GenU エントリも追加できる', async () => {
    const { useRecentlyUsedApps, useRecordRecentlyUsedApp } = await importHooks();
    const { result } = renderHook(() => ({
      entries: useRecentlyUsedApps(),
      record: useRecordRecentlyUsedApp(),
    }));

    act(() => {
      result.current.record(genuInput('chat'));
    });

    expect(result.current.entries[0].key).toBe('genu:chat');
    expect(result.current.entries[0].kind).toBe('genu');
    expect(result.current.entries[0].path).toBe('/chat');
  });

  it('同じ key を再記録すると先頭に来て重複しない', async () => {
    const { useRecentlyUsedApps, useRecordRecentlyUsedApp } = await importHooks();
    const { result } = renderHook(() => ({
      entries: useRecentlyUsedApps(),
      record: useRecordRecentlyUsedApp(),
    }));

    act(() => {
      result.current.record(exappInput({ teamId: 't', exAppId: 'a' }));
      result.current.record(exappInput({ teamId: 't', exAppId: 'b' }));
      result.current.record(exappInput({ teamId: 't', exAppId: 'a' }));
    });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].key).toBe('exapp:t:a');
    expect(result.current.entries[1].key).toBe('exapp:t:b');
  });

  it('9 件追加すると古いものが落ちて 8 件に収まる', async () => {
    const { useRecentlyUsedApps, useRecordRecentlyUsedApp } = await importHooks();
    const { result } = renderHook(() => ({
      entries: useRecentlyUsedApps(),
      record: useRecordRecentlyUsedApp(),
    }));

    act(() => {
      for (let i = 0; i < 9; i++) {
        result.current.record(exappInput({ teamId: 't', exAppId: `app-${i}` }));
      }
    });

    expect(result.current.entries).toHaveLength(8);
    expect(result.current.entries[0].key).toBe('exapp:t:app-8');
    expect(result.current.entries[7].key).toBe('exapp:t:app-1');
  });

  it('record した内容は localStorage に永続化される', async () => {
    const { useRecordRecentlyUsedApp } = await importHooks();
    const { result } = renderHook(() => useRecordRecentlyUsedApp());

    act(() => {
      result.current(exappInput());
    });

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? '{}');
    expect(parsed.version).toBe(1);
    expect(parsed.state.entries).toHaveLength(1);
    expect(parsed.state.entries[0].key).toBe('exapp:team-a:app-1');
  });

  it('useRecordRecentlyUsedApp は再レンダー後も同じ参照を返す', async () => {
    const { useRecordRecentlyUsedApp } = await importHooks();
    const { result, rerender } = renderHook(() => useRecordRecentlyUsedApp());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('localStorage に既存データがあると初期 hydrate される', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          entries: [
            {
              key: 'genu:chat',
              kind: 'genu',
              title: 'チャット',
              path: '/chat',
              usedAt: '2026-05-25T00:00:00.000Z',
            },
          ],
        },
      }),
    );
    const { useRecentlyUsedApps } = await importHooks();
    const { result } = renderHook(() => useRecentlyUsedApps());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].key).toBe('genu:chat');
  });

  it('localStorage の version 不一致は破棄して空状態で開始する', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 99,
        state: { entries: [{ key: 'x' }] },
      }),
    );
    const { useRecentlyUsedApps } = await importHooks();
    const { result } = renderHook(() => useRecentlyUsedApps());
    expect(result.current).toEqual([]);
  });

  it('localStorage のスキーマ違反は破棄して空状態で開始する', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          entries: [{ key: 'k', kind: 'unknown', title: 't', path: '/p', usedAt: 'invalid' }],
        },
      }),
    );
    const { useRecentlyUsedApps } = await importHooks();
    const { result } = renderHook(() => useRecentlyUsedApps());
    expect(result.current).toEqual([]);
  });

  it('破損 JSON でもクラッシュしない', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { useRecentlyUsedApps } = await importHooks();
    const { result } = renderHook(() => useRecentlyUsedApps());
    expect(result.current).toEqual([]);
  });

  it('title が 200 文字を超える場合は 200 文字に切り詰めて保存する', async () => {
    const { useRecentlyUsedApps, useRecordRecentlyUsedApp } = await importHooks();
    const { result } = renderHook(() => ({
      entries: useRecentlyUsedApps(),
      record: useRecordRecentlyUsedApp(),
    }));

    const longTitle = 'あ'.repeat(300);
    act(() => {
      result.current.record({
        kind: 'exapp',
        teamId: 'team-a',
        exAppId: 'app-1',
        title: longTitle,
        path: '/apps/team-a/app-1',
      });
    });

    expect(result.current.entries[0].title).toHaveLength(200);
    expect(result.current.entries[0].title).toBe('あ'.repeat(200));
  });

  it('localStorage の path が外部 URL の場合は破棄して空状態で開始する', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          entries: [
            {
              key: 'genu:chat',
              kind: 'genu',
              title: 'チャット',
              path: 'https://evil.example.com/phishing',
              usedAt: '2026-05-25T00:00:00.000Z',
            },
          ],
        },
      }),
    );
    const { useRecentlyUsedApps } = await importHooks();
    const { result } = renderHook(() => useRecentlyUsedApps());
    expect(result.current).toEqual([]);
  });

  it('localStorage の path が protocol-relative URL の場合も破棄する', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          entries: [
            {
              key: 'genu:chat',
              kind: 'genu',
              title: 'チャット',
              path: '//evil.example.com/phishing',
              usedAt: '2026-05-25T00:00:00.000Z',
            },
          ],
        },
      }),
    );
    const { useRecentlyUsedApps } = await importHooks();
    const { result } = renderHook(() => useRecentlyUsedApps());
    expect(result.current).toEqual([]);
  });
});
