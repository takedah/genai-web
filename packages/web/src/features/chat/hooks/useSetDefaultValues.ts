import { useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router';
import { useChat } from '@/hooks/useChat';
import { MODELS } from '@/models';
import { useChatStore } from '../stores/useChatStore';
import { ChatPageQueryParams } from '../types';

interface LocationState {
  content?: string;
  systemContext?: string;
}

export const useSetDefaultValues = () => {
  const { setContent, setInputSystemContext, setShouldAutoSubmit } = useChatStore();
  const { pathname, search, state } = useLocation();
  const { chatId } = useParams();
  const { getModelId, setModelId, clear, getCurrentSystemContext, updateSystemContext } = useChat(
    pathname,
    chatId,
  );
  const { modelIds: availableModels } = MODELS;
  const modelId = getModelId();

  // state は初回のナビゲーション時のみ有効。
  // ハッシュリンクや戻る/進むボタンで state が失われても再処理しないようにする。
  const hasProcessedStateRef = useRef(false);

  useEffect(() => {
    const defaultModelId = !modelId ? availableModels[0] : modelId;
    const locationState = state as LocationState | undefined;

    if (search === '') {
      setModelId(defaultModelId);
      setShouldAutoSubmit(false);
      hasProcessedStateRef.current = false;
      return;
    }

    // state が処理済みで、かつ state が失われた場合はスキップ
    // （ハッシュリンクのクリックや戻る/進むボタンで state が undefined になる）
    if (hasProcessedStateRef.current && !state) {
      return;
    }

    // state が存在する場合は処理済みとしてマーク
    if (state) {
      hasProcessedStateRef.current = true;
    }

    const params = Object.fromEntries(new URLSearchParams(search)) as ChatPageQueryParams;

    // state または query params から content と systemContext を取得
    const content = locationState?.content ?? params.content ?? '';
    const systemContext = locationState?.systemContext ?? params.systemContext;

    if (systemContext && systemContext !== '') {
      updateSystemContext(systemContext);
      setInputSystemContext(systemContext);
    } else {
      clear();
      setInputSystemContext(getCurrentSystemContext());
    }

    setContent(content);
    setModelId(availableModels.includes(params.modelId ?? '') ? params.modelId! : defaultModelId);
    setShouldAutoSubmit(params.autoSubmit === 'true' && !!content.trim());
  }, [search, state]);
};
