import { act, renderHook } from '@testing-library/react';
import type { InvokeExAppRequest } from 'genai-web';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeExAppMock = vi.fn();
const recordMock = vi.fn();
const flagRef = { enabled: true };

vi.mock('@/features/exapp/invoke/hooks/useInvokeExApp', () => ({
  useInvokeExApp: () => ({ invokeExApp: invokeExAppMock }),
}));

vi.mock('@/hooks/useRecentlyUsedApps', () => ({
  useRecordRecentlyUsedApp: () => recordMock,
  get isRecentlyUsedAppsEnabled() {
    return flagRef.enabled;
  },
}));

const importHook = async () => {
  vi.resetModules();
  return await import('@/features/exapp/invoke/hooks/useExAppInvokeState');
};

const args = {
  teamId: 'team-a',
  exAppId: 'app-1',
  exAppName: 'My ExApp',
};

const request: InvokeExAppRequest = {
  teamId: 'team-a',
  exAppId: 'app-1',
  inputs: {},
  sessionId: 'session-1',
};

describe('useExAppInvokeState', () => {
  beforeEach(() => {
    invokeExAppMock.mockReset();
    recordMock.mockReset();
    flagRef.enabled = true;
  });

  it('実行成功時に record が ExApp 用引数で 1 回だけ呼ばれる', async () => {
    invokeExAppMock.mockResolvedValueOnce({ outputs: 'ok' });
    const { useExAppInvokeState } = await importHook();
    const { result } = renderHook(() => useExAppInvokeState(args));

    await act(async () => {
      await result.current.invokeRequest(request);
    });

    expect(recordMock).toHaveBeenCalledTimes(1);
    expect(recordMock).toHaveBeenCalledWith({
      kind: 'exapp',
      teamId: 'team-a',
      exAppId: 'app-1',
      title: 'My ExApp',
      path: '/apps/team-a/app-1',
    });
  });

  it('実行が失敗したときは record が呼ばれない', async () => {
    invokeExAppMock.mockRejectedValueOnce(new Error('boom'));
    const { useExAppInvokeState } = await importHook();
    const { result } = renderHook(() => useExAppInvokeState(args));

    await act(async () => {
      await expect(result.current.invokeRequest(request)).rejects.toThrow('boom');
    });

    expect(recordMock).not.toHaveBeenCalled();
  });

  it('環境変数 OFF のときは成功しても record が呼ばれない', async () => {
    flagRef.enabled = false;
    invokeExAppMock.mockResolvedValueOnce({ outputs: 'ok' });
    const { useExAppInvokeState } = await importHook();
    const { result } = renderHook(() => useExAppInvokeState(args));

    await act(async () => {
      await result.current.invokeRequest(request);
    });

    expect(recordMock).not.toHaveBeenCalled();
  });
});
