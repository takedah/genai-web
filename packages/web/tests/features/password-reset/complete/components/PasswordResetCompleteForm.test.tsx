import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PASSWORD_POLICY_ERROR_MESSAGE,
  PASSWORD_POLICY_SUPPORT_TEXT,
} from '@/features/password-reset/constants';
import { PasswordResetCompleteForm } from '@/features/password-reset/complete/components/PasswordResetCompleteForm';
import { passwordResetCompleteSchema } from '@/features/password-reset/complete/schema';
import { useCompletePasswordReset } from '@/features/password-reset/complete/hooks/useCompletePasswordReset';
import * as focusModule from '@/utils/focus';

vi.mock('@/features/password-reset/complete/hooks/useCompletePasswordReset');
vi.mock('@/utils/focus');

const mockNavigate = vi.fn();
const mockCompletePasswordReset = vi.fn();
const mockFocus = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('PasswordResetCompleteForm', () => {
  const renderWithRouter = () =>
    render(
      <MemoryRouter>
        <PasswordResetCompleteForm email='user@example.com' />
      </MemoryRouter>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCompletePasswordReset).mockReturnValue({
      completePasswordReset: mockCompletePasswordReset,
    });
    vi.mocked(focusModule.focus).mockImplementation(mockFocus);
  });

  it('renders password inputs and submit button', () => {
    renderWithRouter();

    const emailInput = screen.getByLabelText(/メールアドレス/) as HTMLInputElement;
    expect(emailInput.value).toBe('user@example.com');
    expect(emailInput.readOnly).toBe(true);
    expect(screen.getByLabelText('認証コード※必須')).toBeDefined();
    expect(screen.getByLabelText('新しいパスワード※必須')).toBeDefined();
    expect(screen.getByLabelText('新しいパスワード（確認）※必須')).toBeDefined();
    expect(screen.getByText(PASSWORD_POLICY_SUPPORT_TEXT)).toBeDefined();
    expect(screen.getByRole('button', { name: '更新' })).toBeDefined();
  });

  it('submits email, confirmation code, and new password when valid', async () => {
    const user = userEvent.setup();
    mockCompletePasswordReset.mockResolvedValue({ message: 'ok' });

    renderWithRouter();

    await user.type(screen.getByLabelText('認証コード※必須'), '123456');
    await user.type(screen.getByLabelText('新しいパスワード※必須'), 'NewPass1!');
    await user.type(screen.getByLabelText('新しいパスワード（確認）※必須'), 'NewPass1!');
    await user.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(mockCompletePasswordReset).toHaveBeenCalledWith({
        email: 'user@example.com',
        confirmationCode: '123456',
        newPassword: 'NewPass1!',
        confirmPassword: 'NewPass1!',
      });
    });
  });

  it('shows validation error when password does not satisfy policy', async () => {
    const user = userEvent.setup();

    renderWithRouter();

    await user.type(screen.getByLabelText('認証コード※必須'), '123456');
    await user.type(screen.getByLabelText('新しいパスワード※必須'), 'password');
    await user.type(screen.getByLabelText('新しいパスワード（確認）※必須'), 'password');
    await user.click(screen.getByRole('button', { name: '更新' }));

    expect(await screen.findByText(`＊${PASSWORD_POLICY_ERROR_MESSAGE}`)).toBeDefined();
    expect(mockCompletePasswordReset).not.toHaveBeenCalled();
  });

  it('returns password policy error for empty password input in schema validation', () => {
    const result = passwordResetCompleteSchema.safeParse({
      email: 'user@example.com',
      confirmationCode: '123456',
      newPassword: '',
      confirmPassword: 'Different!234',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.error.flatten().fieldErrors.newPassword).toContain(PASSWORD_POLICY_ERROR_MESSAGE);
  });

  it('treats full-width symbols as invalid password policy input', async () => {
    const user = userEvent.setup();

    renderWithRouter();

    await user.type(screen.getByLabelText('認証コード※必須'), '123456');
    await user.type(screen.getByLabelText('新しいパスワード※必須'), 'NewPassword1！');
    await user.type(screen.getByLabelText('新しいパスワード（確認）※必須'), 'NewPassword1！');
    await user.click(screen.getByRole('button', { name: '更新' }));

    expect(await screen.findByText(`＊${PASSWORD_POLICY_ERROR_MESSAGE}`)).toBeDefined();
    expect(mockCompletePasswordReset).not.toHaveBeenCalled();
  });

  it('shows server error and moves focus target on failure', async () => {
    const user = userEvent.setup();
    mockCompletePasswordReset.mockRejectedValue(new Error('network error'));

    renderWithRouter();

    await user.type(screen.getByLabelText('認証コード※必須'), '123456');
    await user.type(screen.getByLabelText('新しいパスワード※必須'), 'NewPass1!');
    await user.type(screen.getByLabelText('新しいパスワード（確認）※必須'), 'NewPass1!');
    await user.click(screen.getByRole('button', { name: '更新' }));

    expect(
      await screen.findByText(
        'システムエラーが発生しました。ページをリロードして再度お試しください。',
      ),
    ).toBeDefined();
    expect(mockFocus).toHaveBeenCalledWith('server-error');
  });

  it('navigates to sign-in page after successful completion', async () => {
    const user = userEvent.setup();
    mockCompletePasswordReset.mockResolvedValue({ message: 'ok' });

    renderWithRouter();

    await user.type(screen.getByLabelText('認証コード※必須'), '123456');
    await user.type(screen.getByLabelText('新しいパスワード※必須'), 'NewPass1!');
    await user.type(screen.getByLabelText('新しいパスワード（確認）※必須'), 'NewPass1!');
    await user.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
