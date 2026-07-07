import { Link, LinkProps } from 'react-router';

export const RecentlyUsedAppCard = (props: LinkProps) => {
  const { children, to, className, ...rest } = props;
  return (
    <Link
      to={to}
      className={`group flex items-start rounded-16 border border-solid-gray-500 bg-white p-4 hover:bg-blue-50 focus-visible:ring-[calc(2/16*1rem)] focus-visible:ring-yellow-300 focus-visible:outline-4 focus-visible:outline-offset-[calc(2/16*1rem)] focus-visible:outline-black focus-visible:outline-solid ${className ?? ''}`}
      {...rest}
    >
      <span className='text-std-18B-160 underline underline-offset-[calc(3/16*1rem)] group-hover:decoration-[calc(3/16*1rem)]'>
        {children}
      </span>
    </Link>
  );
};
