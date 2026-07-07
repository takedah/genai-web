import { act, fireEvent, render } from '@testing-library/react';
import { ExApp, InvokeExAppHistory } from 'genai-web';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExAppInvokedHistories } from '../../../../../src/features/exapp/invoke/components/ExAppInvokedHistories';

vi.mock('../../../../../src/features/exapp/invoke/hooks/useExAppInvokedHistories');
vi.mock('@/utils/formatDateTime', () => ({
  formatDateTime: () => '2025年1月1日 9:00',
}));

const mockExApp = { teamId: 'team1', exAppId: 'app1' } as ExApp;

const createHistory = (overrides?: Partial<InvokeExAppHistory>): InvokeExAppHistory => ({
  teamId: 'team1',
  teamName: 'テストチーム1',
  exAppId: 'app1',
  exAppName: 'テストアプリ1',
  userId: 'user1',
  createdDate: '1735689600000',
  inputs: { input1: 'テスト入力' },
  outputs: 'テスト出力',
  status: 'COMPLETED',
  progress: '完了',
  ...overrides,
});

const mutate = vi.fn();
const loadMore = vi.fn();

const defaultHookValue = {
  histories: [createHistory()],
  hasMore: false,
  isLoading: false,
  isValidating: false,
  isLoadingMore: false,
  error: undefined,
  mutate,
  loadMore,
  latestHistory: createHistory(),
};

const mockUseExAppInvokedHistories = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  mockUseExAppInvokedHistories.mockReturnValue(defaultHookValue);
  const module = await import(
    '../../../../../src/features/exapp/invoke/hooks/useExAppInvokedHistories'
  );
  vi.mocked(module.useExAppInvokedHistories).mockImplementation(mockUseExAppInvokedHistories);
});

const renderComponent = () =>
  render(
    <MemoryRouter>
      <ExAppInvokedHistories exApp={mockExApp} />
    </MemoryRouter>,
  );

describe('ExAppInvokedHistories', () => {
  it('renders the refresh button when histories exist', () => {
    const { getByRole } = renderComponent();
    expect(getByRole('button', { name: '最新の状態に更新' })).toBeDefined();
  });

  it('renders the refresh button even when there are no histories', () => {
    mockUseExAppInvokedHistories.mockReturnValue({ ...defaultHookValue, histories: [] });
    const { getByRole, getByText } = renderComponent();
    expect(getByRole('button', { name: '最新の状態に更新' })).toBeDefined();
    expect(getByText('利用履歴はありません')).toBeDefined();
  });

  it('calls mutate when the refresh button is clicked', () => {
    const { getByRole } = renderComponent();
    fireEvent.click(getByRole('button', { name: '最新の状態に更新' }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('announces completion via a polite live region after refreshing', async () => {
    vi.useFakeTimers();
    try {
      const { getByRole } = render(
        <MemoryRouter>
          <ExAppInvokedHistories exApp={mockExApp} />
        </MemoryRouter>,
      );
      // key 変更でライブリージョン要素は作り直されるため、毎回取得し直す
      expect(getByRole('status').textContent).toBe('');

      await act(async () => {
        fireEvent.click(getByRole('button', { name: '最新の状態に更新' }));
      });

      // announce は 1 秒遅延してメッセージを設定する
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(getByRole('status').textContent).toBe('利用履歴を最新の状態に更新しました');

      // 5 秒後に自動クリアされる
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(getByRole('status').textContent).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-announces on a second refresh even with the same message', async () => {
    vi.useFakeTimers();
    try {
      const { getByRole } = render(
        <MemoryRouter>
          <ExAppInvokedHistories exApp={mockExApp} />
        </MemoryRouter>,
      );

      await act(async () => {
        fireEvent.click(getByRole('button', { name: '最新の状態に更新' }));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(getByRole('status').textContent).toBe('利用履歴を最新の状態に更新しました');

      // メッセージが残っている間（自動クリア前）に再度更新すると、
      // clearAnnounce と key 変更により一度空に戻る
      await act(async () => {
        fireEvent.click(getByRole('button', { name: '最新の状態に更新' }));
      });
      expect(getByRole('status').textContent).toBe('');

      // 再度 1 秒後にメッセージが設定され直す（変化が検知される）
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(getByRole('status').textContent).toBe('利用履歴を最新の状態に更新しました');
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs and does not announce when refreshing fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mutate.mockRejectedValueOnce(new Error('network error'));
    vi.useFakeTimers();
    try {
      const { getByRole } = render(
        <MemoryRouter>
          <ExAppInvokedHistories exApp={mockExApp} />
        </MemoryRouter>,
      );

      await act(async () => {
        fireEvent.click(getByRole('button', { name: '最新の状態に更新' }));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(consoleError).toHaveBeenCalled();
      expect(getByRole('status').textContent).toBe('');
    } finally {
      vi.useRealTimers();
      consoleError.mockRestore();
    }
  });

  it('shows updating label and does not call mutate while validating', () => {
    mockUseExAppInvokedHistories.mockReturnValue({ ...defaultHookValue, isValidating: true });
    const { getByRole } = renderComponent();
    const button = getByRole('button', { name: '更新中...' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('does not show the refresh button as loading while loading more', () => {
    mockUseExAppInvokedHistories.mockReturnValue({
      ...defaultHookValue,
      hasMore: true,
      isValidating: true,
      isLoadingMore: true,
    });
    const { getByRole, queryByRole } = renderComponent();
    expect(getByRole('button', { name: '最新の状態に更新' })).toBeDefined();
    expect(queryByRole('button', { name: '更新中...' })).toBeNull();
    expect(getByRole('button', { name: '読み込み中' })).toBeDefined();
  });
});
