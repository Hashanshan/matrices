import ViewClient from './view-client';

export default function ViewPage() {
  const fallbackData = [];

  return (
    <ViewClient 
      fallbackData={fallbackData} 
      initialProductId="" 
      initialCategory=""
      initialSubcategory=""
    />
  );
}
