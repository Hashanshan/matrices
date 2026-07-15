// User & Authentication
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zipCode: string;
}

// Products & Catalog
export interface ProductVariant {
  id: string;
  name: string;
  value: string;
  color?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  subcategory?: string;
  image: string;
  images: string[];
  description: string;
  rating: number;
  reviews: number;
  variants: {
    colors: ProductVariant[];
    sizes: ProductVariant[];
  };
  inStock: boolean;
}

// Cart & Orders
export interface CartItem {
  productId: string;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  notes?: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  userDetails: UserProfile;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
}

// Filters & Search
export interface FilterState {
  searchQuery: string;
  categories: string[];
  subcategories: string[]; // Filtered by selected subcategories
  priceRange: [number, number]; // In Rs (0-40000)
  sortBy: 'newest' | 'price-low' | 'price-high' | 'rating';
  gridSize: number;
}
