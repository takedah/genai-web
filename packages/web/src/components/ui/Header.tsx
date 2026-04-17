import { useAuthenticator } from '@aws-amplify/ui-react';
import { useCallback, useEffect, useState } from 'react';
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
  const [groups, setGroups] = useState<string[]>([]);

  const { data } = useAuth();

  useEffect(() => {
    if (data != null && data.tokens != null) {
      setGroups((data.tokens.accessToken.payload['cognito:groups'] as unknown as string[]) ?? []);
    }
  }, [data]);

  const { cache } = useSWRConfig();
  const { signOut } = useAuthenticator();
  const navigate = useNavigate();

  const onClickSignout = useCallback(() => {
    // SWRのキャッシュを全て削除する
    for (const key of cache.keys()) {
      cache.delete(key);
    }
    navigate('/signed-out', { replace: true });
    signOut();
  }, [cache, signOut, navigate]);

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
