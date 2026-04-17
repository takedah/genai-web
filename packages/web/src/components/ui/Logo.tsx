import { Link } from 'react-router';

type Props = {
  isLandingPage?: boolean;
};

const logoTypographyStyles =
  'text-std-18B-160 leading-120! text-solid-gray-900 lg:text-std-22B-150';

export const Logo = (props: Props) => {
  const { isLandingPage } = props;
  return (
    <div className='relative flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-4'>
      {isLandingPage ? (
        <h1 className={`${logoTypographyStyles}`}>ガバメントAI 検証環境</h1>
      ) : (
        <Link
          to='/'
          className={`${logoTypographyStyles} focus-visible:rounded-4 focus-visible:bg-yellow-300 focus-visible:ring-[calc(2/16*1rem)] focus-visible:ring-yellow-300 focus-visible:outline-4 focus-visible:outline-offset-[calc(2/16*1rem)] focus-visible:outline-black focus-visible:outline-solid`}
        >
          ガバメントAI 検証環境
        </Link>
      )}
      <p className='hidden sm:block sm:text-dns-16B-120'>
        <span className='text-dns-14N-120'>Powered by</span> デジタル庁 プロジェクト源内
      </p>
    </div>
  );
};
