import { useEffect, useState } from 'react';
import { PiLightbulbFilamentBold, PiUserFill, PiWarningFill } from 'react-icons/pi';
import { useLocation } from 'react-router';
import { Button } from '@/components/ui/dads/Button';
import { ProgressIndicator } from '@/components/ui/dads/ProgressIndicator';
import { Ul } from '@/components/ui/dads/Ul';
import { BedrockIcon } from '@/components/ui/icons/BedrockIcon';
import { useChat } from '@/hooks/useChat';
import { useFollow } from '@/hooks/useFollow';
import { useLiveStatusMessage } from '@/hooks/useLiveStatusMessage';
import { useScreen } from '@/hooks/useScreen';
import { submitModifierLabel } from '@/utils/keyboard';
import { GenerateImageInput } from './GenerateImageInput';

type Props = {
  className?: string;
  modelId: string;
  onChangeModel: (s: string) => void;
  modelIds: string[];
  content: string;
  isGeneratingImage: boolean;
  onChangeContent: (s: string) => void;
  onGenerate: (prompt: string, negativePrompt: string, stylePreset?: string) => Promise<void>;
};

export const GenerateImageAssistant = (props: Props) => {
  const { pathname } = useLocation();
  const { loading, messages, postChat, popMessage } = useChat(pathname);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const { screen, scrollTopAnchorRef, scrollBottomAnchorRef } = useScreen();
  const { scrollableContainer, setFollowing } = useFollow();

  const contents: (
    | {
        role: 'user';
        content: string;
      }
    | {
        role: 'assistant';
        content: {
          prompt: string | null;
          negativePrompt: string | null;
          comment: string;
          recommendedStylePreset: string[];
          error?: boolean;
        };
      }
  )[] = messages.flatMap((m, idx) => {
    if (m.role === 'user') {
      return {
        role: 'user',
        content: m.content,
      };
    } else {
      if (loading && messages.length - 1 === idx) {
        return {
          role: 'assistant',
          content: {
            prompt: null,
            negativePrompt: null,
            comment: '',
            recommendedStylePreset: [],
          },
        };
      }
      try {
        const matches = m.content.match(/\{[^{}]*\}/g);
        return {
          role: 'assistant',
          content: JSON.parse(matches ? matches[0] : '{}'),
        };
      } catch (e) {
        console.error(e);
        return {
          role: 'assistant',
          content: {
            prompt: null,
            negativePrompt: null,
            comment: '',
            error: true,
            recommendedStylePreset: [],
          },
        };
      }
    }
  });

  useEffect(() => {
    // メッセージ追加時の画像の自動生成
    const _length = contents.length;
    if (contents.length === 0) {
      return;
    }

    const message = contents[_length - 1];
    if (
      !loading &&
      message.role === 'assistant' &&
      message.content.prompt &&
      message.content.negativePrompt
    ) {
      setIsAutoGenerating(true);
      props.onGenerate(message.content.prompt, message.content.negativePrompt).finally(() => {
        setIsAutoGenerating(false);
      });
    }
  }, [loading]);

  const onSend = () => {
    setFollowing(true);
    postChat(props.content);
    props.onChangeContent('');
  };

  const onRetrySend = () => {
    popMessage();
    const lastMessage = popMessage();
    postChat(lastMessage?.content ?? '');
  };

  const lastMessage = contents.length > 0 ? contents[contents.length - 1] : null;
  const { liveStatusMessage } = useLiveStatusMessage({
    isAssistant: lastMessage?.role === 'assistant',
    loading: loading || isAutoGenerating,
    content: lastMessage?.role === 'assistant' ? lastMessage?.content.comment : '',
  });

  return (
    <>
      <div className={`grid h-full grid-rows-[minmax(0,1fr)_auto] ${props.className ?? ''}`}>
        <div
          id='image-assistant-chat'
          className='h-full overflow-x-clip overflow-y-auto py-3 [scrollbar-gutter:stable]'
          ref={screen}
        >
          <div ref={scrollTopAnchorRef} />
          <h2 className='mr-3 mb-2 ml-4 text-std-18B-160 lg:ml-6 lg:text-std-20B-150'>
            チャット形式で画像生成
          </h2>
          {contents.length === 0 ? (
            <div className='mr-3 ml-4 lg:ml-6'>
              <p className='mb-3'>
                チャット形式でプロンプトの生成と設定、画像生成を自動で行います。
              </p>
              <p className='mb-6'>
                ※生成された画像の利用にあたっては、各ユーザーによってその利用が適切かどうかご判断ください。
              </p>
              <div className='mr-3 ml-4 rounded-4 border border-solid-gray-536 bg-solid-gray-50 p-3 text-solid-gray-800'>
                <h3 className='mb-2 flex items-center text-std-17B-170'>
                  <PiLightbulbFilamentBold className='mr-2' />
                  ヒント
                </h3>
                <Ul>
                  <li className='m-1'>
                    具体的かつ詳細な指示を出すようにしましょう。
                    形容詞や副詞を使って、正確に表現することが重要です。
                  </li>
                  <li className='m-1'>
                    「犬が遊んでいる」ではなく、「柴犬が草原で楽しそうに走り回っている」のように具体的に指示をしましょう。
                  </li>
                  <li className='m-1'>
                    文章で書くことが難しい場合は、文章で書く必要はありません。「元気、ボール遊び、ジャンプしている」のように、特徴を羅列して指示をしましょう。
                  </li>
                  <li className='m-1'>
                    除外して欲しい要素も指示することができます。「人間は出力しない」など。
                  </li>
                  <li className='m-1'>
                    LLM
                    が会話の流れを考慮してくれるので、「やっぱり犬じゃなくて猫にして」などの会話形式の指示もできます。
                  </li>
                  <li className='m-1'>
                    プロンプトで意図した画像が生成できない場合は、初期画像の設定やパラメータの変更を試してみましょう。
                  </li>
                </Ul>
              </div>
            </div>
          ) : (
            <div className='mt-4' ref={scrollableContainer}>
              {contents.map((c, idx) => (
                <div
                  key={idx}
                  className={`flex gap-4 border-t border-t-solid-gray-420 px-6 py-3 ${
                    c.role === 'user' ? 'bg-solid-gray-50' : ''
                  }`}
                >
                  <div className='flex-none'>
                    {c?.role === 'user' && (
                      <div className='h-min rounded-sm bg-blue-500 p-2 text-xl text-white'>
                        <PiUserFill />
                      </div>
                    )}
                    {c?.role === 'assistant' && (
                      <div className='h-min rounded-sm bg-green-600 p-1'>
                        <BedrockIcon className='size-7 fill-white' />
                      </div>
                    )}
                  </div>
                  <div className='flex-1 pt-1'>
                    {c.role === 'user' &&
                      c.content.split('\n').map((m, idx) => <div key={idx}>{m}</div>)}
                    {c.role === 'assistant' && c.content.error && (
                      <div>
                        <div className='flex items-center gap-2 font-700 text-error-1'>
                          <PiWarningFill aria-hidden={true} />
                          エラー
                        </div>
                        <p>プロンプト生成中にエラーが発生しました。</p>
                        <div className='mt-3 flex w-full'>
                          <Button variant='outline' size='sm' onClick={onRetrySend}>
                            再実行
                          </Button>
                        </div>
                      </div>
                    )}
                    {c.role === 'assistant' && c.content.prompt === null && !c.content.error && (
                      <div className='flex items-center gap-2'>
                        <ProgressIndicator label='プロンプト生成中' />
                      </div>
                    )}
                    {c.role === 'assistant' &&
                      c.content.prompt !== null &&
                      (contents.length - 1 === idx &&
                      props.isGeneratingImage &&
                      isAutoGenerating ? (
                        <>
                          <div className='flex items-center gap-1'>
                            <div className='mr-1.5 ml-0.5 size-5 rounded-full border-3 border-success-1' />
                            プロンプト生成完了
                          </div>
                          <div className='mt-2 flex items-center gap-1'>
                            <ProgressIndicator label='画像生成中' />
                          </div>
                        </>
                      ) : (
                        <>
                          {c.content.comment.split('\n').map((m, idx) => (
                            <div key={idx}>{m}</div>
                          ))}
                          <div className='mt-4'>
                            <p className='font-bold'>おすすめのスタイルプリセット</p>
                            <div className='mt-3 grid grid-cols-2 gap-1 xl:flex xl:gap-3'>
                              {c.content.recommendedStylePreset.flatMap((preset, idx) => (
                                <Button
                                  variant='outline'
                                  size='sm'
                                  key={idx}
                                  onClick={() => {
                                    props.onGenerate(
                                      c.content.prompt ?? '',
                                      c.content.negativePrompt ?? '',
                                      preset,
                                    );
                                  }}
                                >
                                  {preset}
                                </Button>
                              ))}
                              <Button
                                variant='text'
                                size='sm'
                                onClick={() => {
                                  props.onGenerate(
                                    c.content.prompt ?? '',
                                    c.content.negativePrompt ?? '',
                                    '',
                                  );
                                }}
                              >
                                未設定
                              </Button>
                            </div>
                          </div>
                        </>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={scrollBottomAnchorRef} />
        </div>

        <section
          aria-labelledby='generate-image-assistant-input-heading'
          className='flex w-full items-end justify-center border-t border-t-solid-gray-420'
        >
          <h3 id='generate-image-assistant-input-heading' className='sr-only'>
            メッセージ入力
          </h3>
          <GenerateImageInput
            placeholder={`生成したい画像の概要を入力（Enterで改行、${submitModifierLabel}+Enterで送信します）`}
            textareaId='generate-image-assistant-input'
            aria-labelledby='generate-image-assistant-input-heading'
            content={props.content}
            loading={loading || props.isGeneratingImage}
            onChangeContent={props.onChangeContent}
            onSend={onSend}
          />
        </section>
      </div>
      <div aria-live='assertive' aria-atomic='true' className='sr-only'>
        {liveStatusMessage}
      </div>
    </>
  );
};
