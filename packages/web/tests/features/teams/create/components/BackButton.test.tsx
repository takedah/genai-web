import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BackButton } from '../../../../../src/features/teams/create/components/BackButton';

describe('BackButton', () => {
  it('renders back button with correct text', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <BackButton />
      </MemoryRouter>,
    );

    const link = getByRole('link', { name: /チーム管理に戻る/ });
    expect(link).toBeDefined();
  });

  it('links to /teams', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <BackButton />
      </MemoryRouter>,
    );

    const link = getByRole('link', { name: /チーム管理に戻る/ });
    expect(link.getAttribute('href')).toBe('/teams');
  });

  it('renders with caret left icon', () => {
    const { container } = render(
      <MemoryRouter>
        <BackButton />
      </MemoryRouter>,
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
  });
});
