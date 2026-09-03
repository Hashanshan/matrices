// User & Authentication
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  shopId?: string;
  phone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  hasPinSet?: boolean;
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
  category?: string;
  subcategory?: string;
  categories?: string;       // Mapped from backend `category`
  subcategories?: string;    // Mapped from backend `subCategory`
  image: string;
  imageUrl?: string;
  images?: string[];
  description: string;
  rating?: number;
  reviews?: number;
  productCode?: string;
  productId?: string;
  sellPrice?: number;
  originalPrice?: number;
  variants?: {
    colors: ProductVariant[];
    sizes: ProductVariant[];
  };
  inStock?: boolean;
}

// Cart & Orders
export interface CartItem extends Partial<Product> {
  productId?: string;
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
  userId?: string;
  items: CartItem[];
  total: number;
  date?: string;
  user?: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  };
  userDetails?: UserProfile;
  createdAt?: string;
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | string;
}

// Filters & Search
export interface FilterState {
  searchQuery: string;
  categories: string[];
  subcategories: string[]; // Filtered by selected subcategories
  priceRange: [number, number]; // In Rs (0-40000)
  sortBy: 'newest' | 'price-low' | 'price-high' | 'rating';
  timeFilter?: 'all' | '1week' | '2week' | '3week';
  gridSize: number;
}
