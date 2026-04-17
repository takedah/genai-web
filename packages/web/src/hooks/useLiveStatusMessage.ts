import { useEffect, useRef, useState } from 'react';

type UseLiveStatusMessageProps = {
  isAssistant: boolean;
  assistantName?: string;
  loading?: boolean;
  content?: string;
  error?: string | null;
  /** 開始アナウンスを遅らせるミリ秒数（ページタイトル読み上げとの競合を避けるため） */
  startDelay?: number;
};

// LLMの生成する回答の読み上げ用のカスタムフック
// LLMの回答生成中の状態や、回答生成完了時に回答をスクリーンリーダーで通知するために使用します。
// それ以外の画面更新の読み上げには useAccessibilityAnnouncer フックを使用してください。
export const useLiveStatusMessage = ({
  isAssistant,
  assistantName = 'LLM',
  loading,
  content,
  error,
  startDelay = 0,
}: UseLiveStatusMessageProps) => {
  const [liveStatusMessage, setLiveStatusMessage] = useState('');

  // NOTE: この3つのrefは、aria-live属性を使用してスクリーンリーダーに通知するためのタイマーを管理
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // NOTE： 前回のローディング状態を保持するためのref
  // 初期値は false に固定し、loading の変化を正しく検出する
  // （初回レンダリング時に loading が true だと開始アナウンスがスキップされる問題を防ぐ）
  const prevLoadingRef = useRef<boolean>(false);

  // タイマーのクリーンアップ関数
  const clearTimeouts = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (longTimeoutRef.current) {
      clearTimeout(longTimeoutRef.current);
      longTimeoutRef.current = null;
    }
    if (startDelayTimeoutRef.current) {
      clearTimeout(startDelayTimeoutRef.current);
      startDelayTimeoutRef.current = null;
    }
  };

  // メッセージを設定し、5秒後にクリアする共通関数
  const setMessageWithTimeout = (message: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setLiveStatusMessage(message);

    timeoutRef.current = setTimeout(() => {
      setLiveStatusMessage('');
    }, 5000);
  };

  // コンポーネントのアンマウント時にすべてのタイマーをクリア
  useEffect(() => {
    return clearTimeouts;
  }, []);

  useEffect(() => {
    if (!isAssistant) return;

    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading ?? false;

    if (loading && !wasLoading) {
      // ローディング開始時（startDelay が指定されている場合は遅延させる）
      clearTimeouts();

      const announceStart = () => {
        setMessageWithTimeout(`${assistantName}が回答を生成しています...`);

        // 5秒後に継続メッセージを表示
        longTimeoutRef.current = setTimeout(() => {
          setMessageWithTimeout(`${assistantName}が引き続き回答を生成しています...`);
        }, 5000);
      };

      if (startDelay > 0) {
        startDelayTimeoutRef.current = setTimeout(announceStart, startDelay);
      } else {
        announceStart();
      }
    } else if (!loading && wasLoading) {
      // ローディング完了時
      clearTimeouts();

      if (error) {
        setMessageWithTimeout(`${assistantName}のエラー：${error}`);
      } else if (content) {
        setMessageWithTimeout(`${assistantName}の回答：${content}`);
      } else {
        setMessageWithTimeout(`${assistantName}の回答がありません。`);
      }
    }
    // loading 中の再レンダリングではタイマーをクリアしない（cleanup を返さない）
  }, [loading, content, error, isAssistant, assistantName, startDelay]);

  return { liveStatusMessage };
};
