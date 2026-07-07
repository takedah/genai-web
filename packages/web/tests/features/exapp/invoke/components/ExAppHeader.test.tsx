import { render } from '@testing-library/react';
import { ExApp } from 'genai-web';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ExAppHeader } from '../../../../../src/features/exapp/invoke/components/ExAppHeader';

describe('ExAppHeader (invoke)', () => {
  const mockExApp: ExApp = {
    teamId: 'team-123',
    exAppId: 'app-123',
    exAppName: 'テストアプリ',
    endpoint: 'https://example.com/api',
    placeholder: '{}',
    description: 'テストアプリの説明',
    howToUse: '## 使い方',
    apiKey: 'test-api-key',
    createdDate: '2025-01-01',
    updatedDate: '2025-01-01',
  };

  const defaultProps = {
    exApp: mockExApp,
    teamId: 'team-123',
    exAppId: 'app-123',
  };

  it('h1 にアプリ名が表示される', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <ExAppHeader {...defaultProps} />
      </MemoryRouter>,
    );

    const heading = getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('テストアプリ（アプリ実行）');
  });

  it('パンくずの末尾がアプリ名になる', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <ExAppHeader {...defaultProps} />
      </MemoryRouter>,
    );

    const breadcrumb = getByRole('navigation', { name: '現在位置' });
    const items = breadcrumb.querySelectorAll('li');
    const lastItem = items[items.length - 1];
    expect(lastItem.textContent).toBe('テストアプリ（アプリ実行）');
  });

  it('パンくずのアプリ名がリンクでない', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <ExAppHeader {...defaultProps} />
      </MemoryRouter>,
    );

    const breadcrumb = getByRole('navigation', { name: '現在位置' });
    const items = breadcrumb.querySelectorAll('li');
    const lastItem = items[items.length - 1];
    expect(lastItem.querySelector('a')).toBeNull();
  });
});
