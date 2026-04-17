import { Outlet, useLocation } from 'react-router';
import { Drawer } from '@/components/ui/Drawer';
import { Header } from '@/components/ui/Header';
import { MobileMenuDrawer } from '@/components/ui/MobileMenuDrawer';
import { useMobileMenuHandler } from '@/layout/hooks/useMobileMenuHandler';
import { GEN_U_MENU_ITEMS } from './constants';

export const Layout = () => {
  const { pathname } = useLocation();
  const { mobileMenuRef } = useMobileMenuHandler();

  return (
    <>
      <div className="relative grid h-screen w-screen grid-cols-[auto_1fr] grid-rows-[auto_minmax(0,1fr)] overflow-clip [grid-template-areas:'header_header''side-menu_main']">
        <Header
          className='[grid-area:header]'
          isLandingPage={pathname === '/'}
          onClickMenuToggleForMobile={() => mobileMenuRef.current?.showModal()}
        />
        <div id='main-menu-container' className='hidden [grid-area:side-menu] lg:block'>
          <Drawer items={GEN_U_MENU_ITEMS} />
        </div>
        <main id='mainContents' className='[grid-area:main]'>
          <Outlet />
        </main>
      </div>

      <MobileMenuDrawer ref={mobileMenuRef} onClose={() => mobileMenuRef.current?.close()}>
        <Drawer items={GEN_U_MENU_ITEMS} />
      </MobileMenuDrawer>
    </>
  );
};
