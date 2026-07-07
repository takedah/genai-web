import { type AnchorHTMLAttributes, useCallback } from 'react';
import { Link, type LinkProps, useLocation } from 'react-router';
import { LinkExternalLinkIcon } from '@/components/ui/dads/Link';

const baseClassName = `
  inline-flex items-center justify-center h-11 px-3 text-oln-16B-100 rounded-infinity
  hover:bg-solid-gray-50 hover:underline hover:underline-offset-[calc(3/16*1rem)]
  focus-visible:bg-yellow-300 focus-visible:outline-4 focus-visible:-outline-offset-[calc(2/16*1rem)] focus-visible:outline-black focus-visible:outline-solid`;

type Props = LinkProps & {
  className?: string;
};

export const GlobalMenuLink = (props: Props) => {
  const { className, to, children, ...rest } = props;
  const location = useLocation();

  const ariaCurrentValue = useCallback(() => {
    if (location.pathname === to) {
      return 'page';
    }
    return undefined;
  }, [location.pathname, to]);

  return (
    <Link
      {...rest}
      to={to}
      aria-current={ariaCurrentValue()}
      className={`${baseClassName}
        aria-[current="page"]:bg-blue-50! aria-[current="page"]:text-blue-900! hover:aria-[current="page"]:no-underline! ${className ?? ''}`}
    >
      {children}
    </Link>
  );
};

type ExternalProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> & {
  className?: string;
  to: string;
};

export const GlobalMenuLinkExternal = (props: ExternalProps) => {
  const { className, to, children, ...rest } = props;

  return (
    <a
      {...rest}
      href={to}
      target='_blank'
      rel='noreferrer'
      className={`${baseClassName} ${className ?? ''}`}
    >
      {children}
      <LinkExternalLinkIcon className='mb-0!' />
    </a>
  );
};
