import { ExApp } from 'genai-web';
import { BreadcrumbsNav } from '@/components/ui/BreadcrumbsNav';
import { Tabs } from '@/components/ui/Tabs';

type Props = {
  exApp: ExApp;
  teamId: string;
  exAppId: string;
};

export const ExAppHeader = (props: Props) => {
  const { exApp, teamId, exAppId } = props;
  const basePath = `/apps/${teamId}/${exAppId}`;

  return (
    <div className='flex flex-col gap-4'>
      <BreadcrumbsNav
        items={[
          { label: 'ホーム', to: '/' },
          { label: 'AIアプリ', to: '/apps' },
          { label: `${exApp.exAppName}（アプリ実行）` },
        ]}
      />
      <h1 className='flex justify-start text-std-20B-160 lg:text-std-24B-150'>
        {exApp.exAppName}
        <span className='sr-only'>（アプリ実行）</span>
      </h1>
      <Tabs
        title={exApp.exAppName}
        items={[
          { title: '概要・注意事項', href: basePath, selected: false, state: { fromTab: true } },
          { title: 'アプリ実行', href: `${basePath}/invoke`, selected: true },
        ]}
      />
    </div>
  );
};
