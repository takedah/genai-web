export const ExAppInvokedHistoriesLoading = () => {
  return new Array(5)
    .fill('')
    .map((_, idx) => (
      <div key={idx} aria-hidden={true} className='h-8 w-full animate-pulse rounded-4 bg-blue-50' />
    ));
};
