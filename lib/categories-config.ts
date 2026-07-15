/**
 * CATEGORIES CONFIGURATION
 * 
 * Easy-to-update centralized category and subcategory definitions.
 * Add new categories or subcategories here and they'll automatically
 * be available throughout the application.
 * 
 * Format:
 * {
 *   name: "Category Name",
 *   subcategories: ["Subcategory 1", "Subcategory 2"]
 * }
 */

export interface CategoryConfig {
  name: string;
  subcategories: string[];
}

export const CATEGORIES_CONFIG: CategoryConfig[] = [
  {
    name: 'Electronics',
    subcategories: ['Audio', 'Wearables', 'Video', 'Accessories', 'Peripherals'],
  },
  {
    name: 'Apparel',
    subcategories: ['Clothing', 'Footwear', 'Accessories'],
  },
  {
    name: 'Accessories',
    subcategories: ['Eyewear', 'Handbags', 'Backpacks', 'School Bags', 'Watches'],
  },
  {
    name: 'Bags',
    subcategories: ['Handbags', 'School Bags', 'Backpacks', 'Crossbody Bags', 'Duffle Bags'],
  },
  {
    name: 'Home',
    subcategories: ['Lighting', 'Kitchenware', 'Healthcare'],
  },
  {
    name: 'Sports',
    subcategories: ['Fitness', 'Outdoor', 'Team Sports'],
  },
];

/**
 * Get all category names
 */
export function getAllCategoryNames(): string[] {
  return CATEGORIES_CONFIG.map((cat) => cat.name);
}

/**
 * Get subcategories for a specific category
 */
export function getSubcategoriesForCategory(categoryName: string): string[] {
  const category = CATEGORIES_CONFIG.find(
    (cat) => cat.name.toLowerCase() === categoryName.toLowerCase()
  );
  return category?.subcategories || [];
}

/**
 * Check if a subcategory exists in a category
 */
export function isValidSubcategory(
  categoryName: string,
  subcategoryName: string
): boolean {
  const subcategories = getSubcategoriesForCategory(categoryName);
  return subcategories.some(
    (sub) => sub.toLowerCase() === subcategoryName.toLowerCase()
  );
}

/**
 * Get all unique subcategories across all categories
 */
export function getAllSubcategories(): string[] {
  const allSubs = new Set<string>();
  CATEGORIES_CONFIG.forEach((cat) => {
    cat.subcategories.forEach((sub) => allSubs.add(sub));
  });
  return Array.from(allSubs).sort();
}
