import { useNavigate } from 'react-router';

type Props = {
  title: string;
  path: string;
  queryKey: string;
  text: string;
  context?: string;
  onClose: () => void;
};

export const UseCaseItem = (props: Props) => {
  const { title, path, queryKey, text, context, onClose } = props;

  const navigate = useNavigate();

  return (
    <button
      type='button'
      className={`w-full cursor-pointer p-2 text-left underline underline-offset-[calc(3/16*1rem)] hover:bg-solid-gray-50 hover:decoration-[calc(3/16*1rem)] hover:outline-2 focus-visible:rounded-4 focus-visible:bg-yellow-300 focus-visible:ring-[calc(2/16*1rem)] focus-visible:ring-yellow-300 focus-visible:outline-4 focus-visible:outline-offset-[calc(2/16*1rem)] focus-visible:outline-black focus-visible:outline-solid`}
      onClick={() => {
        onClose();
        navigate(
          `${path}?${new URLSearchParams({ [queryKey]: text, ...(context ? { context } : {}) }).toString()}`,
        );
      }}
    >
      {title}
    </button>
  );
};
