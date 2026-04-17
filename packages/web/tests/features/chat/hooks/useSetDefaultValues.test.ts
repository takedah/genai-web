import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSetDefaultValues } from '../../../../src/features/chat/hooks/useSetDefaultValues';

const mockSetContent = vi.fn();
const mockSetInputSystemContext = vi.fn();
const mockSetShouldAutoSubmit = vi.fn();
const mockSetModelId = vi.fn();
const mockClear = vi.fn();
const mockGetCurrentSystemContext = vi.fn().mockReturnValue('default-system-context');
const mockUpdateSystemContext = vi.fn();
const mockGetModelId = vi.fn().mockReturnValue('model-1');

vi.mock('react-router', () => ({
  useLocation: vi.fn(),
  useParams: vi.fn().mockReturnValue({ chatId: undefined }),
}));

vi.mock('@/features/chat/stores/useChatStore', () => ({
  useChatStore: () => ({
    setContent: mockSetContent,
    setInputSystemContext: mockSetInputSystemContext,
    setShouldAutoSubmit: mockSetShouldAutoSubmit,
  }),
}));

vi.mock('@/hooks/useChat', () => ({
  useChat: () => ({
    getModelId: mockGetModelId,
    setModelId: mockSetModelId,
    clear: mockClear,
    getCurrentSystemContext: mockGetCurrentSystemContext,
    updateSystemContext: mockUpdateSystemContext,
  }),
}));

vi.mock('@/models', () => ({
  MODELS: {
    modelIds: ['model-1', 'model-2', 'model-3'],
  },
}));

describe('useSetDefaultValues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when search is empty', () => {
    it('sets shouldAutoSubmit to false', async () => {
      const { useLocation } = await import('react-router');
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/chat',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useSetDefaultValues());

      expect(mockSetShouldAutoSubmit).toHaveBeenCalledWith(false);
    });

    it('sets default model id', async () => {
      const { useLocation } = await import('react-router');
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/chat',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useSetDefaultValues());

      expect(mockSetModelId).toHaveBeenCalled();
    });
  });

  describe('when autoSubmit parameter is provided', () => {
    it('sets shouldAutoSubmit to true when autoSubmit=true and content is provided', async () => {
      const { useLocation } = await import('react-router');
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/chat',
        search: '?autoSubmit=true&content=test',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useSetDefaultValues());

      expect(mockSetShouldAutoSubmit).toHaveBeenCalledWith(true);
    });

    it('sets shouldAutoSubmit to false when autoSubmit=true but content is empty', async () => {
      const { useLocation } = await import('react-router');
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/chat',
        search: '?autoSubmit=true',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useSetDefaultValues());

      expect(mockSetShouldAutoSubmit).toHaveBeenCalledWith(false);
    });

    it('sets shouldAutoSubmit to false when autoSubmit=false', async () => {
      const { useLocation } = await import('react-router');
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/chat',
        search: '?autoSubmit=false',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useSetDefaultValues());

      expect(mockSetShouldAutoSubmit).toHaveBeenCalledWith(false);
    });

    it('sets shouldAutoSubmit to false when autoSubmit is not provided', async () => {
      const { useLocation } = await import('react-router');
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/chat',
        search: '?content=test',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useSetDefaultValues());

      expect(mockSetShouldAutoSubmit).toHaveBeenCalledWith(false);
    });
  });

  describe('when content parameter is provided', () => {
    it('sets content from query parameter', async () => {
      const { useLocation } = await import('react-router');
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/chat',
        search: '?content=テストメッセージ',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useSetDefaultValues());

      expect(mockSetContent).toHaveBeenCalledWith('テストメッセージ');
    });

    it('sets empty content when content parameter is not provided', async () => {
      const { useLocation } = await import('react-router');
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/chat',
        search: '?autoSubmit=true',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useSetDefaultValues());

      expect(mockSetContent).toHaveBeenCalledWith('');
    });
  });

  describe('when systemContext parameter is provided', () => {
    it('updates system context and sets input system context', async () => {
      const { useLocation } = await import('react-router');
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/chat',
        search: '?systemContext=カスタムプロンプト',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useSetDefaultValues());

      expect(mockUpdateSystemContext).toHaveBeenCalledWith('カスタムプロンプト');
      expect(mockSetInputSystemContext).toHaveBeenCalledWith('カスタムプロンプト');
    });

    it('clears and sets default system context when systemContext is not provided', async () => {
      const { useLocation } = await import('react-router');
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/chat',
        search: '?content=test',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useSetDefaultValues());

      expect(mockClear).toHaveBeenCalled();
      expect(mockSetInputSystemContext).toHaveBeenCalledWith('default-system-context');
    });
  });

  describe('when all parameters are provided', () => {
    it('sets all values correctly', async () => {
      const { useLocation } = await import('react-router');
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/chat',
        search: '?content=テスト&systemContext=プロンプト&autoSubmit=true',
        hash: '',
        state: null,
        key: 'default',
      });

      renderHook(() => useSetDefaultValues());

      expect(mockSetContent).toHaveBeenCalledWith('テスト');
      expect(mockUpdateSystemContext).toHaveBeenCalledWith('プロンプト');
      expect(mockSetInputSystemContext).toHaveBeenCalledWith('プロンプト');
      expect(mockSetShouldAutoSubmit).toHaveBeenCalledWith(true);
    });
  });
});
