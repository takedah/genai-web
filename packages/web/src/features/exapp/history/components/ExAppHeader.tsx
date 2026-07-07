import { ExApp } from 'genai-web';
import { BreadcrumbsNav } from '@/components/ui/BreadcrumbsNav';
import { Tabs } from '@/components/ui/Tabs';

type Props = {
  exApp: ExApp;
  teamId: string;
  exAppId: string;
  historyTitle?: string;
};

export const ExAppHeader = (props: Props) => {
  const { exApp, teamId, exAppId, historyTitle } = props;
  const basePath = `/apps/${teamId}/${exAppId}`;

  const breadcrumbItems = [
    { label: 'ホーム', to: '/' },
    { label: 'AIアプリ', to: '/apps' },
    ...(historyTitle
      ? [{ label: exApp.exAppName, to: basePath }, { label: historyTitle }]
      : [{ label: exApp.exAppName }]),
  ];

  return (
    <div className='flex flex-col gap-4'>
      <BreadcrumbsNav items={breadcrumbItems} />
      <h1 className='flex justify-start text-std-20B-160 lg:text-std-24B-150'>
        {historyTitle || exApp.exAppName}
      </h1>
      <Tabs
        title={exApp.exAppName}
        items={[
          { title: '概要・注意事項', href: basePath, selected: false, state: { fromTab: true } },
          { title: 'アプリ実行', href: `${basePath}/invoke`, selected: false },
        ]}
      />
    </div>
  );
};
