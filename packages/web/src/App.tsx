import { useRoutes } from 'react-router';
import { NavSkip } from '@/components/ui/NavSkip';
import { isUseCaseEnabled } from '@/utils/isUseCaseEnabled';
import { createRoutes } from './routes';

export const App = () => {
  const routes = createRoutes(isUseCaseEnabled);
  const element = useRoutes(routes);

  return (
    <>
      <NavSkip />
      {element}
    </>
  );
};
