/**
 * High-Performance IndexedDB Offline Engine
 * Provides structured client-side storage for offline access.
 */

const DB_NAME = 'MatricesCatalogueOfflineDB';
const DB_VERSION = 2;

export interface SyncMetadata {
  lastSyncedAt: string;
  totalProducts: number;
  totalCategories: number;
  totalSubcategories: number;
  totalShops: number;
}

class OfflineDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available in SSR'));
    }

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Categories store
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        // Subcategories store
        if (!db.objectStoreNames.contains('subcategories')) {
          db.createObjectStore('subcategories', { keyPath: 'id' });
        }
        // Products store
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' });
          productStore.createIndex('categoryId', 'categoryId', { unique: false });
          productStore.createIndex('subcategoryId', 'subcategoryId', { unique: false });
        }
        // Wishlist store
        if (!db.objectStoreNames.contains('wishlist')) {
          db.createObjectStore('wishlist', { keyPath: 'id' });
        }
        // Shops store
        if (!db.objectStoreNames.contains('shops')) {
          db.createObjectStore('shops', { keyPath: 'id' });
        }
        // Orders store
        if (!db.objectStoreNames.contains('orders')) {
          db.createObjectStore('orders', { keyPath: 'id' });
        }
        // Secure store (local PIN hash, user prefs)
        if (!db.objectStoreNames.contains('secure')) {
          db.createObjectStore('secure', { keyPath: 'key' });
        }
        // Meta store
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async saveBatch<T extends { id: string | number }>(storeName: string, items: T[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear(); // Overwrite with fresh sync batch
      items.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getMeta(): Promise<SyncMetadata | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const store = tx.objectStore('meta');
      const request = store.get('sync_metadata');
      request.onsuccess = () => {
        const record = request.result;
        resolve(record ? record.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setMeta(meta: SyncMetadata): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      const store = tx.objectStore('meta');
      store.put({ key: 'sync_metadata', value: meta });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveSecure(key: string, value: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('secure', 'readwrite');
      tx.objectStore('secure').put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSecure(key: string): Promise<string | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('secure', 'readonly');
      const request = tx.objectStore('secure').get(key);
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData(): Promise<void> {
    const db = await this.getDB();
    const stores = ['categories', 'subcategories', 'products', 'wishlist', 'shops', 'orders', 'meta'];
    const tx = db.transaction(stores, 'readwrite');
    stores.forEach((s) => tx.objectStore(s).clear());
  }
}

export const offlineDB = new OfflineDB();
