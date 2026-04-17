import type { AmazonUIImageGenerationMode } from 'genai-web';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { PageTitle } from '@/components/PageTitle';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Divider } from '@/components/ui/dads/Divider';
import { APP_TITLE } from '@/constants';
import { useGenerateImageHandler } from '@/features/generate-image/hooks/useGenerateImageHandler';
import { useReset } from '@/features/generate-image/hooks/useReset';
import { useSetDefaultValues } from '@/features/generate-image/hooks/useSetDefaultValues';
import { useGenerateImageStore } from '@/features/generate-image/stores/useGenerateImageStore';
import { useChat } from '@/hooks/useChat';
import { useSelectedModel } from '@/hooks/useSelectedModel';
import { findModelDisplayNameByModelId, MODELS } from '@/models';
import { getPrompter } from '@/prompts';
import { GeneratedImages } from './components/GeneratedImages';
import { GenerateImageAssistant } from './components/GenerateImageAssistant';
import { ImageGeneratorForm } from './components/ImageGeneratorForm';
import { SketchMaskDialogs } from './components/SketchMaskDialogs';
import { Canvas } from './types';

export const GenerateImagePage = () => {
  const {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    resolution,
    stylePreset,
    setStylePreset,
    generationMode,
    initImage,
    setInitImage,
    maskImage,
    setMaskImage,
    imageSample,
    setImageSample,
    chatContent,
    setChatContent,
    clear,
  } = useGenerateImageStore();

  const { pathname } = useLocation();
  const { loading: loadingChat, clear: clearChat, updateSystemContextByModel } = useChat(pathname);
  const { selectedModelId, setSelectedModelId } = useSelectedModel();

  const [generating, setGenerating] = useState(false);
  const [isOpenSketch, setIsOpenSketch] = useState(false);
  const [isOpenMask, setIsOpenMask] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const previousImageSampleRef = useRef(3);
  const previousGenerationModeRef = useRef<AmazonUIImageGenerationMode>('TEXT_IMAGE');

  const { modelIds } = MODELS;
  const { handleGenerateImage, onClickRandomSeed } = useGenerateImageHandler(setGenerating);

  const prompter = getPrompter(selectedModelId);

  const [width, height] = resolution.label.split('x').map((v) => Number(v));

  useReset();

  useEffect(() => {
    if (generationMode === 'BACKGROUND_REMOVAL') {
      previousImageSampleRef.current = imageSample;
      setImageSample(1);
    } else if (previousGenerationModeRef.current === 'BACKGROUND_REMOVAL') {
      setImageSample(previousImageSampleRef.current);
    }
    previousGenerationModeRef.current = generationMode;
  }, [generationMode]);

  useEffect(() => {
    updateSystemContextByModel();
  }, [prompter]);

  useSetDefaultValues();

  const onChangeInitImageBase64 = useCallback(
    (s: Canvas) => {
      setInitImage(s);
      setIsOpenSketch(false);
    },
    [setInitImage],
  );

  const onChangeMaskImageBase64 = useCallback(
    (s: Canvas) => {
      setMaskImage(s);
      setIsOpenMask(false);
    },
    [setMaskImage],
  );

  const clearAll = useCallback(() => {
    setSelectedImageIndex(0);
    clear();
    clearChat();
  }, [clear, clearChat]);

  return (
    <>
      <PageTitle title={`画像を生成 | ${APP_TITLE}`} />
      <div className='h-full'>
        <div className='grid h-full grid-rows-[auto_minmax(0,1fr)]'>
          <div className='border-b border-b-black px-4 pt-4 pb-2 lg:px-6'>
            <h1 className='mb-1 flex justify-start text-std-20B-160 lg:text-std-24B-150'>
              画像を生成
            </h1>
            <div className='mt-2 flex w-full'>
              <CustomSelect
                label='LLM：'
                labelClassName='text-dns-14B-120'
                value={selectedModelId}
                onChange={setSelectedModelId}
                options={modelIds.map((m) => {
                  return { value: m, label: findModelDisplayNameByModelId(m) };
                })}
              />
            </div>
          </div>

          <div>
            <div className='grid h-full grid-cols-[1fr_24rem] grid-rows-1'>
              <div className='min-h-0 border-r border-r-solid-gray-420'>
                <GenerateImageAssistant
                  modelId={selectedModelId}
                  onChangeModel={setSelectedModelId}
                  modelIds={modelIds}
                  content={chatContent}
                  onChangeContent={setChatContent}
                  isGeneratingImage={generating}
                  onGenerate={async (p, np, sp) => {
                    // 設定に変更があった場合のみ生成する
                    if (p !== prompt || np !== negativePrompt || (sp ?? '') !== stylePreset) {
                      setSelectedImageIndex(0);
                      setPrompt(p);
                      setNegativePrompt(np);
                      if (sp !== undefined) {
                        setStylePreset(sp);
                      }
                      return handleGenerateImage(p, np, sp);
                    }
                  }}
                />
              </div>

              <div className='min-h-0 overflow-x-clip overflow-y-auto [scrollbar-gutter:stable]'>
                <div className='py-3 pr-3 pl-4'>
                  <h2 className='mb-4 text-std-18B-160 lg:text-std-20B-150'>画像生成結果</h2>

                  <GeneratedImages
                    generating={generating}
                    selectedImageIndex={selectedImageIndex}
                    setSelectedImageIndex={setSelectedImageIndex}
                  />

                  <Divider className='my-3 lg:my-6' />

                  <ImageGeneratorForm
                    loadingChat={loadingChat}
                    generating={generating}
                    selectedImageIndex={selectedImageIndex}
                    setSelectedImageIndex={setSelectedImageIndex}
                    setIsOpenSketch={setIsOpenSketch}
                    setIsOpenMask={setIsOpenMask}
                    generateImage={handleGenerateImage}
                    clearAll={clearAll}
                    onClickRandomSeed={() => onClickRandomSeed(selectedImageIndex)}
                  />

                  <Divider className='my-3 lg:my-6' />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SketchMaskDialogs
        width={width}
        height={height}
        initImage={initImage}
        maskImage={maskImage}
        isOpenSketch={isOpenSketch}
        isOpenMask={isOpenMask}
        onCloseSketch={() => setIsOpenSketch(false)}
        onCloseMask={() => setIsOpenMask(false)}
        onChangeInitImage={onChangeInitImageBase64}
        onChangeMaskImage={onChangeMaskImageBase64}
      />
    </>
  );
};
