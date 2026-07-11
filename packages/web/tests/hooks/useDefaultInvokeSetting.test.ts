import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDefaultInvokeSetting } from '../../src/hooks/useDefaultInvokeSetting';

describe('useDefaultInvokeSetting', () => {
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

  it('returns false by default when localStorage is empty', () => {
    const { result } = renderHook(() => useDefaultInvokeSetting('generate'));

    expect(result.current[0]).toBe(false);
  });

  it('returns true when the key is in the stored array', () => {
    mockLocalStorage['default_invoke_apps'] = '["generate","translate"]';

    const { result } = renderHook(() => useDefaultInvokeSetting('generate'));

    expect(result.current[0]).toBe(true);
  });

  it('returns false when the key is not in the stored array', () => {
    mockLocalStorage['default_invoke_apps'] = '["translate"]';

    const { result } = renderHook(() => useDefaultInvokeSetting('generate'));

    expect(result.current[0]).toBe(false);
  });

  it('adds key to the array when setIsDefault(true) is called', () => {
    mockLocalStorage['default_invoke_apps'] = '["translate"]';

    const { result } = renderHook(() => useDefaultInvokeSetting('generate'));

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    const stored = JSON.parse(mockLocalStorage['default_invoke_apps']);
    expect(stored).toContain('generate');
    expect(stored).toContain('translate');
  });

  it('removes key from the array when setIsDefault(false) is called', () => {
    mockLocalStorage['default_invoke_apps'] = '["generate","translate"]';

    const { result } = renderHook(() => useDefaultInvokeSetting('generate'));

    act(() => {
      result.current[1](false);
    });

    expect(result.current[0]).toBe(false);
    const stored = JSON.parse(mockLocalStorage['default_invoke_apps']);
    expect(stored).not.toContain('generate');
    expect(stored).toContain('translate');
  });

  it('does not add duplicate keys', () => {
    mockLocalStorage['default_invoke_apps'] = '["generate"]';

    const { result } = renderHook(() => useDefaultInvokeSetting('generate'));

    act(() => {
      result.current[1](true);
    });

    const stored = JSON.parse(mockLocalStorage['default_invoke_apps']);
    expect(stored.filter((k: string) => k === 'generate')).toHaveLength(1);
  });

  it('handles invalid JSON in localStorage gracefully', () => {
    mockLocalStorage['default_invoke_apps'] = 'invalid-json';

    const { result } = renderHook(() => useDefaultInvokeSetting('generate'));

    expect(result.current[0]).toBe(false);
  });

  it('works with ExApp keys', () => {
    mockLocalStorage['default_invoke_apps'] = '["exapp_abc123"]';

    const { result } = renderHook(() => useDefaultInvokeSetting('exapp_abc123'));

    expect(result.current[0]).toBe(true);
  });

  it('toggles value correctly', () => {
    const { result } = renderHook(() => useDefaultInvokeSetting('generate'));

    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1](true);
    });
    expect(result.current[0]).toBe(true);

    act(() => {
      result.current[1](false);
    });
    expect(result.current[0]).toBe(false);
  });
});
