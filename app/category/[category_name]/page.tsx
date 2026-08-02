import CategoryClient from './category-client';

export function generateStaticParams() {
  return [{ category_name: 'all' }, { category_name: 'general' }];
}

export default function CategoryDetailPage() {
  return <CategoryClient />;
}
