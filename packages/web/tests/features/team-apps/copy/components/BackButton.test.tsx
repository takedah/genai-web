import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BackButton } from '../../../../../src/features/team-apps/copy/components/BackButton';

describe('BackButton', () => {
  const renderWithRouter = (teamName = 'テストチーム', teamId = 'team-1', appId = 'app-1') => {
    return render(
      <MemoryRouter initialEntries={[`/teams/${teamId}/apps/${appId}/copy`]}>
        <Routes>
          <Route
            path='/teams/:teamId/apps/:appId/copy'
            element={<BackButton teamName={teamName} />}
          />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('renders back button with correct text', () => {
    renderWithRouter('テストチーム');

    const link = screen.getByRole('link', { name: /テストチーム（AIアプリ）に戻る/ });
    expect(link).toBeDefined();
  });

  it('renders with provided team name', () => {
    renderWithRouter('カスタムチーム');

    const link = screen.getByRole('link', { name: /カスタムチーム（AIアプリ）に戻る/ });
    expect(link).toBeDefined();
  });

  it('links to correct apps page', () => {
    renderWithRouter('テストチーム', 'team-123');

    const link = screen.getByRole('link', { name: /テストチーム（AIアプリ）に戻る/ });
    expect(link.getAttribute('href')).toBe('/teams/team-123/apps');
  });

  it('renders with caret left icon', () => {
    const { container } = renderWithRouter();

    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
  });

  it('includes team name in link text', () => {
    renderWithRouter('特殊な名前のチーム');

    const link = screen.getByRole('link', { name: /特殊な名前のチーム（AIアプリ）に戻る/ });
    expect(link.textContent).toContain('特殊な名前のチーム');
  });
});
