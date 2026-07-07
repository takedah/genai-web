import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultInvokeCheckbox } from '../../../../../src/features/exapp/invoke/components/DefaultInvokeCheckbox';

describe('DefaultInvokeCheckbox', () => {
  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return mockLocalStorage[key] ?? null;
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      mockLocalStorage[key] = value;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(mockLocalStorage)) {
      delete mockLocalStorage[key];
    }
  });

  it('renders checkbox with label text', () => {
    render(<DefaultInvokeCheckbox storageKey='generate' />);

    expect(
      screen.getByLabelText(
        'アプリを開いたとき、「概要・注意事項」をスキップして「アプリ実行」を表示する',
      ),
    ).toBeDefined();
  });

  it('renders unchecked by default when localStorage is empty', () => {
    render(<DefaultInvokeCheckbox storageKey='generate' />);

    const checkbox = screen.getByRole('checkbox');
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  it('renders checked when the key is in the stored array', () => {
    mockLocalStorage['default_invoke_apps'] = '["generate"]';

    render(<DefaultInvokeCheckbox storageKey='generate' />);

    const checkbox = screen.getByRole('checkbox');
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });

  it('adds key to localStorage when clicked', async () => {
    const user = userEvent.setup();

    render(<DefaultInvokeCheckbox storageKey='generate' />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    const stored = JSON.parse(mockLocalStorage['default_invoke_apps']);
    expect(stored).toContain('generate');
  });

  it('removes key from localStorage when unchecked', async () => {
    mockLocalStorage['default_invoke_apps'] = '["generate","translate"]';
    const user = userEvent.setup();

    render(<DefaultInvokeCheckbox storageKey='generate' />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    const stored = JSON.parse(mockLocalStorage['default_invoke_apps']);
    expect(stored).not.toContain('generate');
    expect(stored).toContain('translate');
  });
});
