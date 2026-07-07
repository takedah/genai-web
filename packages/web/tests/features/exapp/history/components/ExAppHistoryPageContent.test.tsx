import { fireEvent, render } from '@testing-library/react';
import { InvokeExAppHistory } from 'genai-web';
import { MemoryRouter } from 'react-router';
import { unstable_serialize } from 'swr/infinite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExAppHistoryPageContent } from '../../../../../src/features/exapp/history/components/ExAppHistoryPageContent';
import { getExAppHistoriesKey } from '../../../../../src/features/exapp/history/hooks/useFetchInvokedExAppHistories';

const mutateHistory = vi.fn();
const globalMutate = vi.fn();

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useParams: () => ({ teamId: 'team1', exAppId: 'app1', createdDate: '1735689600000' }),
  };
});

vi.mock('swr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('swr')>();
  return {
    ...actual,
    useSWRConfig: () => ({ mutate: globalMutate }),
  };
});

vi.mock('../../../../../src/features/exapp/hooks/useFetchExApp', () => ({
  useFetchExApp: () => ({
    data: {
      teamId: 'team1',
      exAppId: 'app1',
      exAppName: 'テストアプリ',
      placeholder: '{}',
      systemPrompt: '',
      systemPromptKeyName: '',
    },
  }),
}));

const mockHistory: InvokeExAppHistory = {
  teamId: 'team1',
  teamName: 'テストチーム',
  exAppId: 'app1',
  exAppName: 'テストアプリ',
  userId: 'user1',
  createdDate: '1735689600000',
  inputs: {},
  outputs: '',
  status: 'IN_PROGRESS',
  progress: '処理中',
};

vi.mock('../../../../../src/features/exapp/history/hooks/useFetchExAppHistoryItem', () => ({
  useFetchExAppHistoryItem: () => ({
    data: { history: mockHistory },
    mutate: mutateHistory,
  }),
}));

// 重い依存はスタブ化。ExAppHistoryOutputs は onReload を発火するボタンのみ描画する。
vi.mock('../../../../../src/features/exapp/history/components/ExAppHeader', () => ({
  ExAppHeader: () => null,
}));
vi.mock('../../../../../src/features/exapp/history/components/ExAppHistoryInputs', () => ({
  ExAppHistoryInputs: () => null,
}));
vi.mock('../../../../../src/features/exapp/history/components/ExAppHistorySidebar', () => ({
  ExAppHistorySidebar: () => null,
}));
vi.mock('../../../../../src/features/exapp/history/components/ExAppHistoryOutputs', () => ({
  ExAppHistoryOutputs: ({ onReload }: { onReload: () => Promise<void> }) => (
    <button type='button' onClick={() => onReload()}>
      状態を更新
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const renderComponent = () =>
  render(
    <MemoryRouter>
      <ExAppHistoryPageContent />
    </MemoryRouter>,
  );

describe('ExAppHistoryPageContent', () => {
  it('revalidates both the single history item and the sidebar list on reload', async () => {
    const { getByRole } = renderComponent();

    fireEvent.click(getByRole('button', { name: '状態を更新' }));

    expect(mutateHistory).toHaveBeenCalledTimes(1);
    expect(globalMutate).toHaveBeenCalledTimes(1);
    expect(globalMutate).toHaveBeenCalledWith(
      unstable_serialize(getExAppHistoriesKey('team1', 'app1')),
    );
  });
});
