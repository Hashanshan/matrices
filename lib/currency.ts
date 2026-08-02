export const formatPrice = (price: number | undefined | null): string => {
  const val = typeof price === 'number' ? price : 0;
  return `Rs ${val.toLocaleString('en-LK')}`;
};

export const formatPriceSimple = (price: number | undefined | null): string => {
  const val = typeof price === 'number' ? price : 0;
  return `Rs ${val.toLocaleString('en-LK')}`;
};
