import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD_RESET_COMPLETE_PATH } from '@/features/password-reset/constants';
import { PasswordResetRequestForm } from '@/features/password-reset/request/components/PasswordResetRequestForm';
import { useRequestPasswordReset } from '@/features/password-reset/request/hooks/useRequestPasswordReset';
import * as focusModule from '@/utils/focus';

vi.mock('@/features/password-reset/request/hooks/useRequestPasswordReset');
vi.mock('@/utils/focus');

const mockNavigate = vi.fn();
const mockRequestPasswordReset = vi.fn();
const mockFocus = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('PasswordResetRequestForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRequestPasswordReset).mockReturnValue({
      requestPasswordReset: mockRequestPasswordReset,
    });
    vi.mocked(focusModule.focus).mockImplementation(mockFocus);
  });

  it('renders email input and submit button', () => {
    render(<PasswordResetRequestForm />);

    expect(screen.getByRole('textbox', { name: /メールアドレス/ })).toBeDefined();
    expect(screen.getByRole('button', { name: '送信' })).toBeDefined();
  });

  it('submits the email address without normalizing it', async () => {
    const user = userEvent.setup();
    mockRequestPasswordReset.mockResolvedValue(undefined);

    render(<PasswordResetRequestForm />);

    await user.type(
      screen.getByRole('textbox', { name: /メールアドレス/ }),
      'User+Test@Example.COM',
    );
    await user.click(screen.getByRole('button', { name: '送信' }));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('User+Test@Example.COM');
    });
  });

  it('navigates to complete page with email after successful submission', async () => {
    const user = userEvent.setup();
    mockRequestPasswordReset.mockResolvedValue(undefined);

    render(<PasswordResetRequestForm />);

    await user.type(screen.getByRole('textbox', { name: /メールアドレス/ }), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '送信' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(PASSWORD_RESET_COMPLETE_PATH, {
        state: {
          email: 'user@example.com',
        },
      });
    });
  });

  it('shows server error and moves focus target on failure', async () => {
    const user = userEvent.setup();
    mockRequestPasswordReset.mockRejectedValue(new Error('network error'));

    render(<PasswordResetRequestForm />);

    await user.type(screen.getByRole('textbox', { name: /メールアドレス/ }), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '送信' }));

    expect(
      await screen.findByText(
        'システムエラーが発生しました。ページをリロードして再度お試しください。',
      ),
    ).toBeDefined();
    expect(mockFocus).toHaveBeenCalledWith('server-error');
  });
});
