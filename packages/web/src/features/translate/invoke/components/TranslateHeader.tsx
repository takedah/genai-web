import { BreadcrumbsNav } from '@/components/ui/BreadcrumbsNav';
import { Tabs } from '@/components/ui/Tabs';

export const TranslateHeader = () => {
  return (
    <div className='flex flex-col gap-4'>
      <BreadcrumbsNav
        items={[
          { label: 'ホーム', to: '/' },
          { label: 'AIアプリ', to: '/apps' },
          { label: '翻訳' },
        ]}
      />
      <h1 className='flex justify-start text-std-20B-160 lg:text-std-24B-150'>翻訳</h1>
      <Tabs
        title='翻訳'
        items={[
          {
            title: '概要・注意事項',
            href: '/translate',
            selected: false,
            state: { fromTab: true },
          },
          { title: 'このアプリを使う', href: '/translate/invoke', selected: true },
        ]}
      />
    </div>
  );
};
