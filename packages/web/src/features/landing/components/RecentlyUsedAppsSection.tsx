import { RecentlyUsedAppCard } from '@/features/landing/components/RecentlyUsedAppCard';
import { isRecentlyUsedAppsEnabled, useRecentlyUsedApps } from '@/hooks/useRecentlyUsedApps';

export const RecentlyUsedAppsSection = () => {
  const entries = useRecentlyUsedApps();

  if (!isRecentlyUsedAppsEnabled) {
    return null;
  }

  return (
    <div className='mt-8 lg:mt-10'>
      <h2 className='mb-6 flex justify-start text-std-24B-150'>最近使ったAIアプリ</h2>
      {entries.length === 0 ? (
        <p className='text-std-16N-170'>
          最近使ったAIアプリはまだありません。アプリを実行すると、ここに利用したAIアプリが表示されます。
        </p>
      ) : (
        <ul className='grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4'>
          {entries.map((entry) => (
            <li key={entry.key}>
              <RecentlyUsedAppCard to={entry.path} className='h-full'>
                {entry.title}
              </RecentlyUsedAppCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
