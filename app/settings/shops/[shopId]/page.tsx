import ShopClient from './shop-client';

export function generateStaticParams() {
  return [{ shopId: '1' }, { shopId: 'default' }];
}

export default function ShopSingleViewPage({ params }: { params: Promise<{ shopId: string }> }) {
  return <ShopClient params={params} />;
}
