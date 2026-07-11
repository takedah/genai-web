import type { Artifact, EstimatedCostSummary, ExAppInvokeStatus, UsageMetadata } from 'genai-web';
import { useRef, useState } from 'react';
import { Markdown } from '@/components/Markdown';
import { ButtonCopy } from '@/components/ui/ButtonCopy';
import { DownloadIcon } from '@/components/ui/icons/DownloadIcon';
import { UpdateIcon } from '@/components/ui/icons/UpdateIcon';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { download } from '@/utils/createDownloadLink';
import { ExAppUsageCost } from '../../components/ExAppUsageCost';
import { useGetArtifactFile } from '../hooks/useGetArtifactFile';

type Props = {
  status: ExAppInvokeStatus;
  parsedOutputs: string;
  progress: string;
  artifacts: Artifact[] | undefined;
  usageMetadata?: UsageMetadata[];
  totalEstimatedCost?: EstimatedCostSummary;
  onReload: () => Promise<void>;
};

export const ExAppHistoryOutputs = ({
  status,
  parsedOutputs,
  progress,
  artifacts,
  usageMetadata,
  totalEstimatedCost,
  onReload,
}: Props) => {
  const [isReloading, setIsReloading] = useState(false);
  const [loadingArtifacts, setLoadingArtifacts] = useState<string[]>([]);
  const { getArtifactFileUrl } = useGetArtifactFile();
  const copyTextRef = useRef<HTMLDivElement>(null);

  const handleReload = async () => {
    setIsReloading(true);
    try {
      await onReload();
    } catch {
      console.error('Failed to reload history');
    } finally {
      setIsReloading(false);
    }
  };

  const downloadArtifact = async (fileUrl: string, displayName: string) => {
    setLoadingArtifacts((prev) => [...prev, fileUrl]);
    try {
      const signedUrl = await getArtifactFileUrl(fileUrl);
      download(signedUrl, displayName);
    } catch (error) {
      console.error('Error loading file:', error);
    } finally {
      setLoadingArtifacts((prev) => prev.filter((url) => url !== fileUrl));
    }
  };

  return (
    <article className='w-full border border-solid-gray-420 bg-white p-4 rounded-12 lg:p-6'>
      <h3 className='sr-only'>出力結果</h3>
      <div>
        {status === 'ERROR' && (
          <p className='text-error-2'>実行中にエラーが発生しました。再度お試しください。</p>
        )}
        {status === 'ACCEPTED' && (
          <div>
            <p>処理を受け付けました。しばらくお待ちください。</p>
            <LoadingButton
              className='mt-3 min-w-[calc(134/16*1rem)] justify-start gap-1.5'
              loading={isReloading}
              variant='outline'
              size='sm'
              type='button'
              onClick={handleReload}
            >
              {!isReloading && <UpdateIcon aria-hidden={true} />}
              {isReloading ? '更新中...' : '状態を更新'}
            </LoadingButton>
          </div>
        )}
        {status === 'IN_PROGRESS' && (
          <div>
            <p>{progress}</p>
            <LoadingButton
              className='mt-3 min-w-[calc(134/16*1rem)] justify-start gap-1.5'
              loading={isReloading}
              variant='outline'
              size='sm'
              type='button'
              onClick={handleReload}
            >
              {!isReloading && <UpdateIcon aria-hidden={true} />}
              {isReloading ? '更新中...' : '状態を更新'}
            </LoadingButton>
          </div>
        )}
        {status === 'COMPLETED' && (
          <div>
            <div ref={copyTextRef}>
              <Markdown>{parsedOutputs}</Markdown>
            </div>
            <ExAppUsageCost usageMetadata={usageMetadata} totalEstimatedCost={totalEstimatedCost} />
            <div className='mt-2 flex w-full justify-end'>
              <ButtonCopy
                text={parsedOutputs}
                targetRef={copyTextRef}
                label='出力結果をコピー'
                copiedLabel='コピー完了'
                className='min-w-[calc(184/16*1rem)]'
              />
            </div>

            {artifacts && artifacts.length > 0 && (
              <dl className='mt-2 border-t border-t-solid-gray-420 pt-4'>
                <dt className='mb-2 text-std-17B-170'>ファイル一覧:</dt>
                <dd>
                  <ul className='space-y-4'>
                    {artifacts.map((artifact) => {
                      const isDownloading = loadingArtifacts.includes(artifact.file_url);
                      return (
                        <li key={artifact.file_url}>
                          <LoadingButton
                            type='button'
                            loading={isDownloading}
                            onClick={() =>
                              downloadArtifact(artifact.file_url, artifact.display_name)
                            }
                            variant='outline'
                            size='md'
                          >
                            {!isDownloading && <DownloadIcon aria-hidden={true} />}
                            {artifact.display_name}
                            <span className='sr-only'>をダウンロード</span>
                          </LoadingButton>
                        </li>
                      );
                    })}
                  </ul>
                </dd>
              </dl>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
