import { useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate } from 'react-router';
import { useSWRConfig } from 'swr';
import { AccountMenu } from '@/components/ui/AccountMenu';
import {
  HamburgerMenuButton,
  HamburgerWithLabelIcon,
} from '@/components/ui/dads/HamburgerMenuButton';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/hooks/useAuth';

type Props = {
  className?: string;
  isLandingPage?: boolean;
  onClickMenuToggleForMobile: () => void;
};

export const Header = (props: Props) => {
  const { className, isLandingPage, onClickMenuToggleForMobile } = props;

  const { data } = useAuth();
  const groups =
    (data?.tokens?.accessToken.payload['cognito:groups'] as unknown as string[] | undefined) ?? [];

  const { cache } = useSWRConfig();
  const { signOut } = useAuthenticator();
  const navigate = useNavigate();

  const onClickSignout = () => {
    // SWRのキャッシュを全て削除する
    for (const key of cache.keys()) {
      cache.delete(key);
    }
    navigate('/signed-out', { replace: true });
    signOut();
  };

  return (
    <header
      className={`flex h-(--header-height) items-center justify-start border-b border-b-solid-gray-420 bg-white pl-1.5 lg:pl-4 ${className ?? ''}`}
    >
      {/* For Mobile view */}
      <HamburgerMenuButton
        className={`relative mr-1.5 hover:outline-black hover:outline-solid lg:hidden`}
        aria-controls='main-menu-container'
        aria-haspopup='dialog'
        onClick={onClickMenuToggleForMobile}
      >
        <HamburgerWithLabelIcon className='flex-none' />
      </HamburgerMenuButton>
      <Logo isLandingPage={isLandingPage} />

      <div className='ml-auto flex h-full'>
        <AccountMenu
          onClickSignout={onClickSignout}
          isShowTeamManagementMenu={
            groups.includes('SystemAdminGroup') || groups.includes('TeamAdminGroup')
          }
        />
      </div>
    </header>
  );
};
