/**
 * High-Performance IndexedDB Offline Engine
 * Provides structured client-side storage for offline access.
 */

const DB_NAME = 'MatricesCatalogueOfflineDB';
const DB_VERSION = 4;

export interface SyncMetadata {
  lastSyncedAt: string;
  totalProducts: number;
  totalCategories: number;
  totalSubcategories: number;
  totalShops: number;
  totalOrders: number;
  totalImages: number;
  imageStorageMB: number;
}

export interface ImageMapRecord {
  url: string;
  localSrc: string;
  sizeBytes: number;
  updatedAt: string;
}

class OfflineDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  public getDB(): Promise<IDBDatabase> {
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
        // Image Map store for native offline files
        if (!db.objectStoreNames.contains('image_map')) {
          db.createObjectStore('image_map', { keyPath: 'url' });
        }
        // Pending Actions store for offline changes sync
        if (!db.objectStoreNames.contains('pending_actions')) {
          db.createObjectStore('pending_actions', { keyPath: 'id' });
        }
        // Sync Queue store for structured sequential push queue
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          queueStore.createIndex('queueId', 'queueId', { unique: false });
          queueStore.createIndex('status', 'status', { unique: false });
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

  async getCount(storeName: string): Promise<number> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => resolve(0);
    });
  }

  async saveImageMap(record: ImageMapRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('image_map', 'readwrite');
      tx.objectStore('image_map').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getImageMap(url: string): Promise<ImageMapRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('image_map', 'readonly');
      const request = tx.objectStore('image_map').get(url);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async getImageStorageSummary(): Promise<{ count: number; totalBytes: number }> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      let count = 0;
      let totalBytes = 0;
      const tx = db.transaction('image_map', 'readonly');
      const store = tx.objectStore('image_map');
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          count++;
          totalBytes += cursor.value.sizeBytes || 0;
          cursor.continue();
        } else {
          resolve({ count, totalBytes });
        }
      };
      req.onerror = () => resolve({ count: 0, totalBytes: 0 });
    });
  }

  async getAllImageMaps(): Promise<ImageMapRecord[]> {
    return this.getAll<ImageMapRecord>('image_map').catch(() => []);
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
    const stores = ['categories', 'subcategories', 'products', 'wishlist', 'shops', 'orders', 'meta', 'image_map'];
    return new Promise((resolve, reject) => {
      const existingStores = stores.filter((s) => db.objectStoreNames.contains(s));
      if (existingStores.length === 0) return resolve();
      const tx = db.transaction(existingStores, 'readwrite');
      existingStores.forEach((s) => tx.objectStore(s).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Put (insert or update) a single record without clearing the store */
  async upsert<T>(storeName: string, item: T): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Delete a single record by its key */
  async deleteById(storeName: string, id: string | number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Get a single record by its key */
  async getOne<T>(storeName: string, id: string | number): Promise<T | null> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(id);
      request.onsuccess = () => resolve((request.result as T) || null);
      request.onerror = () => resolve(null);
    });
  }
}

export const offlineDB = new OfflineDB();

