import CatalogueClient from './catalogue-client';

export default function CataloguePage() {
  const fallbackData = { categories: [], priceRange: { min: 0, max: 40000 } };

  return (
    <CatalogueClient fallbackData={fallbackData} />
  );
}
