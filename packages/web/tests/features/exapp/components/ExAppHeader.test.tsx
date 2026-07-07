import { render } from '@testing-library/react';
import { ExApp } from 'genai-web';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ExAppHeader } from '../../../../src/features/exapp/components/ExAppHeader';

describe('ExAppHeader', () => {
  const mockExApp: ExApp = {
    teamId: 'team-123',
    exAppId: 'app-123',
    exAppName: 'テストアプリ',
    endpoint: 'https://example.com/api',
    placeholder: '{}',
    description: 'テストアプリの説明',
    howToUse: '## 使い方\n\nこれはテストアプリの使い方です。',
    apiKey: 'test-api-key',
    createdDate: '2025-01-01',
    updatedDate: '2025-01-01',
  };

  it('renders exAppName as h1', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <ExAppHeader exApp={mockExApp} teamId='team-123' exAppId='app-123' />
      </MemoryRouter>,
    );

    const heading = getByRole('heading', { level: 1 });
    expect(heading).toBeDefined();
    expect(heading.textContent).toBe('テストアプリ（概要・注意事項）');
  });

  it('renders tabs with correct links', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <ExAppHeader exApp={mockExApp} teamId='team-123' exAppId='app-123' />
      </MemoryRouter>,
    );

    const nav = getByRole('navigation', { name: 'テストアプリの目次' });
    expect(nav).toBeDefined();
  });

  it('marks description tab as selected', () => {
    const { getByText } = render(
      <MemoryRouter>
        <ExAppHeader exApp={mockExApp} teamId='team-123' exAppId='app-123' />
      </MemoryRouter>,
    );

    const descriptionTab = getByText('概要・注意事項');
    expect(descriptionTab.getAttribute('aria-current')).toBe('page');
  });

  it('renders invoke tab as a link with correct href', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <ExAppHeader exApp={mockExApp} teamId='team-123' exAppId='app-123' />
      </MemoryRouter>,
    );

    const invokeLink = getByRole('link', { name: 'アプリ実行' });
    expect(invokeLink).toBeDefined();
    expect(invokeLink.getAttribute('href')).toBe('/apps/team-123/app-123/invoke');
  });
});
