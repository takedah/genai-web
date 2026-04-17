import { Link } from 'react-router';
import { DrawerBase } from './DrawerBase';
import { DrawerItem, type DrawerItemProps } from './DrawerItem';
import { Button } from './dads/Button';

export type MenuItemProps = DrawerItemProps;

type Props = {
  className?: string;
  items: MenuItemProps[];
};

type RecommendedGovAI = {
  title: string;
  teamId: string;
  exAppId: string;
};

export const Drawer = (props: Props) => {
  const { className, items } = props;
  const recommendedGovAI: RecommendedGovAI[] = (() => {
    try {
      const data = import.meta.env.VITE_APP_GOVAIS_FOR_SIDEBAR;
      return typeof data === 'string' ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to parse recommended GovAI data', error);
      return [];
    }
  })();

  const showRecommendedGovAI = recommendedGovAI && recommendedGovAI.length > 0;

  return (
    <DrawerBase className={`${className ?? ''}`}>
      <div className='flex flex-col gap-4 pt-4'>
        <ul className='py-1 pr-2 pl-4'>
          <li>
            <DrawerItem label='AIアプリ一覧' to='/apps' disableParentAriaCurrent />
          </li>
        </ul>
        <div>
          <h3 className='mb-3 px-4 text-dns-16B-130'>おすすめ</h3>
          <ul className='py-1 pr-2 pl-4'>
            {showRecommendedGovAI &&
              recommendedGovAI.map((govAI) => (
                <li key={govAI.exAppId}>
                  <DrawerItem label={govAI.title} to={`/apps/${govAI.teamId}/${govAI.exAppId}`} />
                </li>
              ))}
            {items.map((item) => (
              <li key={`${item.label}-${item.to}`}>
                <DrawerItem label={item.label} to={item.to} />
              </li>
            ))}
          </ul>
          <div className='mt-2 text-center'>
            <Button variant='text' size='sm' asChild className='inline-flex items-center'>
              <Link to='/apps'>すべてのAIアプリを見る</Link>
            </Button>
          </div>
        </div>
      </div>
    </DrawerBase>
  );
};
