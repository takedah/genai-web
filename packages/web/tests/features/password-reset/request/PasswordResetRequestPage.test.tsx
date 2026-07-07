import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PasswordResetRequestPage } from '../../../../src/features/password-reset/request/PasswordResetRequestPage';

describe('PasswordResetRequestPage', () => {
  const renderWithRouter = () =>
    render(
      <MemoryRouter>
        <PasswordResetRequestPage />
      </MemoryRouter>,
    );

  it('uses the same heading structure as the sign-in screen', () => {
    renderWithRouter();

    expect(
      screen.getByRole('heading', { level: 2, name: 'パスワード再設定（メール送信）' }),
    ).toBeDefined();
  });

  it('renders a sign-in link', () => {
    renderWithRouter();

    const link = screen.getByRole('link', { name: 'サインインに戻る' });
    expect(link.getAttribute('href')).toBe('/');
  });
});
