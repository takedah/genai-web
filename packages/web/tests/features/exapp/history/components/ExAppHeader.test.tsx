import { render } from '@testing-library/react';
import { ExApp } from 'genai-web';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ExAppHeader } from '../../../../../src/features/exapp/history/components/ExAppHeader';

describe('ExAppHeader (history)', () => {
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

  describe('historyTitle なし', () => {
    it('h1 にアプリ名が表示される', () => {
      const { getByRole } = render(
        <MemoryRouter>
          <ExAppHeader {...defaultProps} />
        </MemoryRouter>,
      );

      const heading = getByRole('heading', { level: 1 });
      expect(heading.textContent).toBe('テストアプリ');
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
      expect(lastItem.textContent).toBe('テストアプリ');
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

  describe('historyTitle あり', () => {
    it('h1 に履歴タイトルが表示される', () => {
      const { getByRole } = render(
        <MemoryRouter>
          <ExAppHeader {...defaultProps} historyTitle='会議録の要約' />
        </MemoryRouter>,
      );

      const heading = getByRole('heading', { level: 1 });
      expect(heading.textContent).toBe('会議録の要約');
    });

    it('パンくずの末尾が履歴タイトルになる', () => {
      const { getByRole } = render(
        <MemoryRouter>
          <ExAppHeader {...defaultProps} historyTitle='会議録の要約' />
        </MemoryRouter>,
      );

      const breadcrumb = getByRole('navigation', { name: '現在位置' });
      const items = breadcrumb.querySelectorAll('li');
      const lastItem = items[items.length - 1];
      expect(lastItem.textContent).toBe('会議録の要約');
    });

    it('パンくずのアプリ名がリンクになる', () => {
      const { getByRole } = render(
        <MemoryRouter>
          <ExAppHeader {...defaultProps} historyTitle='会議録の要約' />
        </MemoryRouter>,
      );

      const breadcrumb = getByRole('navigation', { name: '現在位置' });
      const appNameLink = breadcrumb.querySelector('a[href="/apps/team-123/app-123"]');
      expect(appNameLink).not.toBeNull();
      expect(appNameLink!.textContent).toBe('テストアプリ');
    });
  });
});
