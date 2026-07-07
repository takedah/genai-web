import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStorage } from '../../src/hooks/useSessionStorage';

describe('useSessionStorage', () => {
  const mockSessionStorage: Record<string, string> = {};

  beforeEach(() => {
    // sessionStorage のモック
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return mockSessionStorage[key] ?? null;
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      mockSessionStorage[key] = value;
    });
  });

  afterEach(() => {
    // モックのクリア
    vi.restoreAllMocks();
    for (const key of Object.keys(mockSessionStorage)) {
      delete mockSessionStorage[key];
    }
  });

  it('returns default value when sessionStorage is empty', () => {
    const { result } = renderHook(() => useSessionStorage('testKey', 'defaultValue'));

    expect(result.current[0]).toBe('defaultValue');
  });

  it('returns stored value when sessionStorage has the key', () => {
    mockSessionStorage['testKey'] = 'storedValue';

    const { result } = renderHook(() => useSessionStorage('testKey', 'defaultValue'));

    expect(result.current[0]).toBe('storedValue');
  });

  it('updates value and sessionStorage when setValue is called', () => {
    const { result } = renderHook(() => useSessionStorage('testKey', 'defaultValue'));

    act(() => {
      result.current[1]('newValue');
    });

    expect(result.current[0]).toBe('newValue');
    expect(mockSessionStorage['testKey']).toBe('newValue');
  });

  it('updates value multiple times correctly', () => {
    const { result } = renderHook(() => useSessionStorage('testKey', 'defaultValue'));

    act(() => {
      result.current[1]('firstValue');
    });
    expect(result.current[0]).toBe('firstValue');

    act(() => {
      result.current[1]('secondValue');
    });
    expect(result.current[0]).toBe('secondValue');
    expect(mockSessionStorage['testKey']).toBe('secondValue');
  });

  it('handles empty string as value', () => {
    const { result } = renderHook(() => useSessionStorage('testKey', 'defaultValue'));

    act(() => {
      result.current[1]('');
    });

    expect(result.current[0]).toBe('');
    expect(mockSessionStorage['testKey']).toBe('');
  });

  it('handles different keys independently', () => {
    const { result: result1 } = renderHook(() => useSessionStorage('key1', 'default1'));
    const { result: result2 } = renderHook(() => useSessionStorage('key2', 'default2'));

    act(() => {
      result1.current[1]('value1');
    });

    expect(result1.current[0]).toBe('value1');
    expect(result2.current[0]).toBe('default2');
    expect(mockSessionStorage['key1']).toBe('value1');
    expect(mockSessionStorage['key2']).toBeUndefined();
  });
});
