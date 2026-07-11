import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'recently_used_apps';

const renderWithRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const importComponent = async () => {
  vi.resetModules();
  const mod = await import('@/features/landing/components/RecentlyUsedAppsSection');
  return mod.RecentlyUsedAppsSection;
};

const importHook = async () => await import('@/hooks/useRecentlyUsedApps');

describe('RecentlyUsedAppsSection', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.clear();
  });

  it('環境変数が無効のときは何も描画しない', async () => {
    vi.stubEnv('VITE_APP_RECENTLY_USED_APPS_ENABLED', 'false');
    const Section = await importComponent();
    const { container } = renderWithRouter(<Section />);
    expect(container.firstChild).toBeNull();
  });

  it('環境変数が有効で 0 件のときは案内文を表示する', async () => {
    vi.stubEnv('VITE_APP_RECENTLY_USED_APPS_ENABLED', 'true');
    const Section = await importComponent();
    renderWithRouter(<Section />);

    expect(screen.getByRole('heading', { level: 2, name: '最近使ったAIアプリ' })).toBeDefined();
    expect(screen.getByText(/最近使ったAIアプリはまだありません/)).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('環境変数が有効でエントリがあるとき リンクのリストを表示する', async () => {
    vi.stubEnv('VITE_APP_RECENTLY_USED_APPS_ENABLED', 'true');
    const Section = await importComponent();
    const { useRecordRecentlyUsedApp } = await importHook();

    const recordRef: { current: ReturnType<typeof useRecordRecentlyUsedApp> | undefined } = {
      current: undefined,
    };
    const Capture = () => {
      recordRef.current = useRecordRecentlyUsedApp();
      return null;
    };

    renderWithRouter(
      <>
        <Capture />
        <Section />
      </>,
    );

    act(() => {
      recordRef.current?.({
        kind: 'exapp',
        teamId: 'team-a',
        exAppId: 'app-1',
        title: 'ExApp 1',
        path: '/apps/team-a/app-1',
      });
      recordRef.current?.({
        kind: 'genu',
        genuKind: 'chat',
        title: 'チャット',
        path: '/chat',
      });
    });

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const chatLink = screen.getByRole('link', { name: 'チャット' });
    expect(chatLink.getAttribute('href')).toBe('/chat');

    const exAppLink = screen.getByRole('link', { name: 'ExApp 1' });
    expect(exAppLink.getAttribute('href')).toBe('/apps/team-a/app-1');

    // セクション見出し（h2）以外の見出しは出さない
    const headings = screen.getAllByRole('heading');
    expect(headings).toHaveLength(1);
    expect(headings[0].tagName).toBe('H2');
  });

  it('localStorage に既存エントリがあると初回描画でリンクが出る', async () => {
    vi.stubEnv('VITE_APP_RECENTLY_USED_APPS_ENABLED', 'true');
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          entries: [
            {
              key: 'genu:translate',
              kind: 'genu',
              title: '翻訳',
              description: '手元の文章を他の言語に翻訳',
              path: '/translate',
              usedAt: '2026-05-20T00:00:00.000Z',
            },
          ],
        },
      }),
    );
    const Section = await importComponent();
    renderWithRouter(<Section />);

    const link = screen.getByRole('link', { name: /翻訳/ });
    expect(link.getAttribute('href')).toBe('/translate');
  });
});
