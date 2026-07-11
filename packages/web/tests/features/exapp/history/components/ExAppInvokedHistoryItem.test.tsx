import { render } from '@testing-library/react';
import { InvokeExAppHistory } from 'genai-web';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExAppInvokedHistoryItem } from '../../../../../src/features/exapp/history/components/ExAppInvokedHistoryItem';

vi.mock('@/utils/formatDateTime', () => ({
  formatDateTime: () => '2025年1月1日 9:00',
}));

describe('ExAppInvokedHistoryItem', () => {
  const mockHistory: InvokeExAppHistory = {
    teamId: 'team1',
    teamName: 'テストチーム1',
    exAppId: 'app1',
    exAppName: 'テストアプリ1',
    userId: 'user1',
    createdDate: '1735689600000', // 2025-01-01T00:00:00.000Z
    inputs: {
      input1: 'テスト用の入力内容',
    },
    outputs: 'テスト用の出力内容',
    status: 'COMPLETED',
    progress: '完了',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (
    props: Partial<React.ComponentProps<typeof ExAppInvokedHistoryItem>> = {},
  ) => {
    return render(
      <MemoryRouter>
        <ExAppInvokedHistoryItem history={mockHistory} {...props} />
      </MemoryRouter>,
    );
  };

  it('renders as a link to the history page', () => {
    const { getByRole } = renderComponent();

    const link = getByRole('link');
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toEqual('/apps/team1/app1/invoke/1735689600000');
  });

  it('renders history time correctly', () => {
    const { getByText, container } = renderComponent();

    expect(getByText('2025年1月1日 9:00')).toBeDefined();

    const timeElement = container.querySelector('time');
    expect(timeElement).toBeDefined();
    expect(timeElement?.getAttribute('datetime')).toEqual('2025-01-01T00:00:00.000Z');
  });

  it('renders COMPLETED status label', () => {
    const { getByText } = renderComponent();
    expect(getByText('完了')).toBeDefined();
  });

  it('renders ACCEPTED status label', () => {
    const { getByText } = renderComponent({
      history: { ...mockHistory, status: 'ACCEPTED' },
    });
    expect(getByText('受付済')).toBeDefined();
  });

  it('renders IN_PROGRESS status label', () => {
    const { getByText } = renderComponent({
      history: { ...mockHistory, status: 'IN_PROGRESS' },
    });
    expect(getByText('処理中')).toBeDefined();
  });

  it('renders ERROR status label', () => {
    const { getByText } = renderComponent({
      history: { ...mockHistory, status: 'ERROR' },
    });
    expect(getByText('エラー')).toBeDefined();
  });

  it('renders predictedTitle when present', () => {
    const { getByText } = renderComponent({
      history: { ...mockHistory, predictedTitle: 'テスト要約タイトル' },
    });
    expect(getByText('テスト要約タイトル')).toBeDefined();
  });

  it('does not render title element when predictedTitle is empty', () => {
    const { container } = renderComponent({
      history: { ...mockHistory, predictedTitle: '' },
    });
    const link = container.querySelector('a');
    const paragraphs = link?.querySelectorAll('p');
    expect(paragraphs?.length).toBe(0);
  });

  it('does not render title element when predictedTitle is undefined', () => {
    const { container } = renderComponent({
      history: { ...mockHistory, predictedTitle: undefined },
    });
    const link = container.querySelector('a');
    const paragraphs = link?.querySelectorAll('p');
    expect(paragraphs?.length).toBe(0);
  });
});
