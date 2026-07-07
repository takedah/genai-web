import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/isUseCaseEnabled', () => ({
  isUseCaseEnabled: vi.fn(),
}));

import { isUseCaseEnabled } from '@/utils/isUseCaseEnabled';
import { getAvailableGenuApps } from '../../src/utils/getAvailableGenuApps';

const mockedIsUseCaseEnabled = vi.mocked(isUseCaseEnabled);

describe('getAvailableGenuApps', () => {
  afterEach(() => {
    mockedIsUseCaseEnabled.mockReset();
  });

  it('全フラグ ON の場合は 6 アプリすべてを返す', () => {
    mockedIsUseCaseEnabled.mockReturnValue(true);

    const apps = getAvailableGenuApps();

    expect(apps.map((a) => a.kind)).toEqual([
      'chat',
      'generate',
      'translate',
      'image',
      'diagram',
      'transcribe',
    ]);
  });

  it('translate / image / diagram が OFF の場合はそれらが除外される', () => {
    mockedIsUseCaseEnabled.mockReturnValue(false);

    const apps = getAvailableGenuApps();

    expect(apps.map((a) => a.kind)).toEqual(['chat', 'generate', 'transcribe']);
  });

  it('translate のみ ON の場合は translate を含み、image / diagram は除外される', () => {
    mockedIsUseCaseEnabled.mockImplementation(
      (...keys: ('translate' | 'image' | 'diagram')[]) => keys[0] === 'translate',
    );

    const apps = getAvailableGenuApps();

    expect(apps.map((a) => a.kind)).toEqual(['chat', 'generate', 'translate', 'transcribe']);
  });

  it('返るメタは label と description を持つ', () => {
    mockedIsUseCaseEnabled.mockReturnValue(true);

    const apps = getAvailableGenuApps();

    for (const app of apps) {
      expect(app.label).not.toBe('');
      expect(app.description).not.toBe('');
    }
  });
});
