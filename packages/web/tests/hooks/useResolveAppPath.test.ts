import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResolveAppPath } from '../../src/hooks/useResolveAppPath';

describe('useResolveAppPath', () => {
  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return mockLocalStorage[key] ?? null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(mockLocalStorage)) {
      delete mockLocalStorage[key];
    }
  });

  describe('resolveGenUAppPath', () => {
    it('returns normal path when default invoke is not set', () => {
      const { result } = renderHook(() => useResolveAppPath());

      expect(result.current.resolveGenUAppPath('generate')).toBe('/generate');
    });

    it('returns invoke path when default invoke is set', () => {
      mockLocalStorage['default_invoke_apps'] = '["generate"]';

      const { result } = renderHook(() => useResolveAppPath());

      expect(result.current.resolveGenUAppPath('generate')).toBe('/generate/invoke');
    });

    it('returns normal path for non-target apps regardless of setting', () => {
      mockLocalStorage['default_invoke_apps'] = '["chat"]';

      const { result } = renderHook(() => useResolveAppPath());

      expect(result.current.resolveGenUAppPath('chat')).toBe('/chat');
    });

    it('resolves each target app correctly', () => {
      mockLocalStorage['default_invoke_apps'] = '["generate","translate","diagram","transcribe"]';

      const { result } = renderHook(() => useResolveAppPath());

      expect(result.current.resolveGenUAppPath('generate')).toBe('/generate/invoke');
      expect(result.current.resolveGenUAppPath('translate')).toBe('/translate/invoke');
      expect(result.current.resolveGenUAppPath('diagram')).toBe('/diagram/invoke');
      expect(result.current.resolveGenUAppPath('transcribe')).toBe('/transcribe/invoke');
    });

    it('returns normal path when only other apps are set', () => {
      mockLocalStorage['default_invoke_apps'] = '["translate"]';

      const { result } = renderHook(() => useResolveAppPath());

      expect(result.current.resolveGenUAppPath('generate')).toBe('/generate');
    });

    it('handles invalid JSON gracefully', () => {
      mockLocalStorage['default_invoke_apps'] = 'invalid';

      const { result } = renderHook(() => useResolveAppPath());

      expect(result.current.resolveGenUAppPath('generate')).toBe('/generate');
    });
  });

  describe('resolveExAppPath', () => {
    it('returns normal path when default invoke is not set', () => {
      const { result } = renderHook(() => useResolveAppPath());

      expect(result.current.resolveExAppPath('team1', 'app1')).toBe('/apps/team1/app1');
    });

    it('returns invoke path when default invoke is set', () => {
      mockLocalStorage['default_invoke_apps'] = '["exapp_app1"]';

      const { result } = renderHook(() => useResolveAppPath());

      expect(result.current.resolveExAppPath('team1', 'app1')).toBe('/apps/team1/app1/invoke');
    });

    it('returns normal path when a different exapp is set', () => {
      mockLocalStorage['default_invoke_apps'] = '["exapp_other"]';

      const { result } = renderHook(() => useResolveAppPath());

      expect(result.current.resolveExAppPath('team1', 'app1')).toBe('/apps/team1/app1');
    });

    it('handles invalid JSON gracefully', () => {
      mockLocalStorage['default_invoke_apps'] = '{broken}';

      const { result } = renderHook(() => useResolveAppPath());

      expect(result.current.resolveExAppPath('team1', 'app1')).toBe('/apps/team1/app1');
    });
  });
});
