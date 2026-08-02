import OrderPdfClient from './order-client';

export function generateStaticParams() {
  return [{ orderId: '1' }, { orderId: 'default' }];
}

export default function OrderPdfSinglePage({ params }: { params: Promise<{ orderId: string }> }) {
  return <OrderPdfClient params={params} />;
}
