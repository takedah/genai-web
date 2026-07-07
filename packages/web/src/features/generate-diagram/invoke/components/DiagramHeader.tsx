import { BreadcrumbsNav } from '@/components/ui/BreadcrumbsNav';
import { Tabs } from '@/components/ui/Tabs';

export const DiagramHeader = () => {
  return (
    <div className='flex flex-col gap-4'>
      <BreadcrumbsNav
        items={[
          { label: 'ホーム', to: '/' },
          { label: 'AIアプリ', to: '/apps' },
          { label: 'ダイアグラムを生成' },
        ]}
      />
      <h1 className='flex justify-start text-std-20B-160 lg:text-std-24B-150'>
        ダイアグラムを生成
      </h1>
      <Tabs
        title='ダイアグラムを生成'
        items={[
          { title: '概要・注意事項', href: '/diagram', selected: false, state: { fromTab: true } },
          { title: 'このアプリを使う', href: '/diagram/invoke', selected: true },
        ]}
      />
    </div>
  );
};
