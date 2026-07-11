import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { PasswordResetCompletePage } from '../../../../src/features/password-reset/complete/PasswordResetCompletePage';

describe('PasswordResetCompletePage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('renders the form when email exists in route state', () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/password-reset/complete', state: { email: 'user@example.com' } },
        ]}
      >
        <PasswordResetCompletePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'パスワード再設定（新しいパスワードを設定）' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: '更新' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'サインインに戻る' }).getAttribute('href')).toBe('/');
  });

  it('shows retry message when email state is missing', () => {
    render(
      <MemoryRouter initialEntries={['/password-reset/complete']}>
        <PasswordResetCompletePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('メールアドレス入力からやり直してください。')).toBeDefined();
    expect(
      screen.getByRole('link', { name: '再設定メールを再送信する' }).getAttribute('href'),
    ).toBe('/password-reset/request');
  });
});
