import { BreadcrumbsNav } from '@/components/ui/BreadcrumbsNav';
import { Tabs } from '@/components/ui/Tabs';

export const GenerateTextHeader = () => {
  return (
    <div className='flex flex-col gap-4'>
      <BreadcrumbsNav
        items={[
          { label: 'ホーム', to: '/' },
          { label: 'AIアプリ', to: '/apps' },
          { label: '文章を生成' },
        ]}
      />
      <h1 className='flex justify-start text-std-20B-160 lg:text-std-24B-150'>文章を生成</h1>
      <Tabs
        title='文章を生成'
        items={[
          { title: '概要・注意事項', href: '/generate', selected: false, state: { fromTab: true } },
          { title: 'このアプリを使う', href: '/generate/invoke', selected: true },
        ]}
      />
    </div>
  );
};
