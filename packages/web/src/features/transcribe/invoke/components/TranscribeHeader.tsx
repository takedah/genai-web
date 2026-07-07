import { BreadcrumbsNav } from '@/components/ui/BreadcrumbsNav';
import { Tabs } from '@/components/ui/Tabs';

export const TranscribeHeader = () => {
  return (
    <div className='flex flex-col gap-4'>
      <BreadcrumbsNav
        items={[
          { label: 'ホーム', to: '/' },
          { label: 'AIアプリ', to: '/apps' },
          { label: '音声ファイルから文字起こし' },
        ]}
      />
      <h1 className='mb-2 flex justify-start text-std-20B-160 lg:text-std-24B-150'>
        音声ファイルから文字起こし
      </h1>
      <Tabs
        title='音声ファイルから文字起こし'
        items={[
          {
            title: '概要・注意事項',
            href: '/transcribe',
            selected: false,
            state: { fromTab: true },
          },
          { title: 'このアプリを使う', href: '/transcribe/invoke', selected: true },
        ]}
      />
    </div>
  );
};
