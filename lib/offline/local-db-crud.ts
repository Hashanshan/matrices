/**
 * Local-First CRUD Engine
 *
 * All mutations (create/update/delete) hit IndexedDB immediately and return success
 * instantly without waiting for the network. The operation is queued in the SyncQueue
 * and will be pushed to the server when the user runs "Push Changes" or when the app
 * comes back online.
 *
 * Usage:
 *   const shop = await localCreate('shops', shopData, { endpoint: '/api/shops', entity: 'Shop', title: 'Create Shop' });
 *   await localUpdate('shops', shopId, patch, { endpoint: `/api/shops/${shopId}`, entity: 'Shop', title: 'Update Shop' });
 *   await localDelete('shops', shopId, { endpoint: `/api/shops/${shopId}`, entity: 'Shop', title: 'Delete Shop' });
 */

import { offlineDB } from './indexed-db';
import { addToSyncQueue } from './pending-sync';

interface QueueOptions {
  endpoint: string;
  entity: string;
  entityId?: string;
  title: string;
  /** Set to false to skip queueing (local-only write, no sync) */
  queue?: boolean;
}

/**
 * Create a record locally (IndexedDB) and queue a CREATE operation.
 * Returns the saved item immediately.
 */
export async function localCreate<T extends { id: string }>(
  storeName: string,
  item: T,
  opts: QueueOptions
): Promise<T> {
  // 1. Save to IndexedDB immediately
  await offlineDB.upsert(storeName, item);

  // 2. Queue for server sync
  if (opts.queue !== false) {
    await addToSyncQueue({
      operation: 'CREATE',
      entity: opts.entity,
      entityId: opts.entityId || item.id,
      endpoint: opts.endpoint,
      method: 'POST',
      payload: item,
      title: opts.title,
    });
  }

  return item;
}

/**
 * Update a record locally (IndexedDB) with a partial patch and queue an UPDATE operation.
 * Merges patch with the existing record. Returns the merged item.
 */
export async function localUpdate<T extends { id: string }>(
  storeName: string,
  id: string,
  patch: Partial<T>,
  opts: QueueOptions
): Promise<T | null> {
  // 1. Fetch current record
  const existing = await offlineDB.getOne<T>(storeName, id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = (existing ? { ...existing, ...patch } : { id, ...patch }) as unknown as T;

  // 2. Save merged record to IndexedDB
  await offlineDB.upsert(storeName, updated);

  // 3. Queue for server sync
  if (opts.queue !== false) {
    await addToSyncQueue({
      operation: 'UPDATE',
      entity: opts.entity,
      entityId: opts.entityId || id,
      endpoint: opts.endpoint,
      method: 'PUT',
      payload: patch,
      title: opts.title,
    });
  }

  return updated;
}

/**
 * Delete a record locally (IndexedDB) and queue a DELETE operation.
 */
export async function localDelete(
  storeName: string,
  id: string,
  opts: QueueOptions
): Promise<void> {
  // 1. Remove from IndexedDB immediately
  await offlineDB.deleteById(storeName, id);

  // 2. Queue for server sync
  if (opts.queue !== false) {
    await addToSyncQueue({
      operation: 'DELETE',
      entity: opts.entity,
      entityId: opts.entityId || id,
      endpoint: opts.endpoint,
      method: 'DELETE',
      payload: { id },
      title: opts.title,
    });
  }
}

/**
 * Optimistic online-first mutation helper.
 * Tries the API first; on failure, falls back to local CRUD + queue.
 *
 * Use this when online mode is preferred but offline resilience is needed.
 */
export async function optimisticMutate<T extends { id: string }>(opts: {
  storeName: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  id: string;
  data: Partial<T> & { id: string };
  apiCall: () => Promise<Response>;
  queueOpts: QueueOptions;
}): Promise<{ success: boolean; local: boolean; data?: T }> {
  const { storeName, operation, id, data, apiCall, queueOpts } = opts;

  // Try API first if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const res = await apiCall();
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const serverItem = json.data || json.shop || json.order || json.product || data;

        // Mirror the server response into local DB so UI stays consistent
        if (operation !== 'DELETE') {
          await offlineDB.upsert(storeName, { ...data, ...serverItem, id });
        } else {
          await offlineDB.deleteById(storeName, id);
        }

        return { success: true, local: false, data: serverItem as T };
      }
    } catch {
      // Network error → fall through to local-first
    }
  }

  // Offline / network-error fallback: write locally and queue
  if (operation === 'CREATE') {
    const item = await localCreate(storeName, data as T, queueOpts);
    return { success: true, local: true, data: item };
  } else if (operation === 'UPDATE') {
    const item = await localUpdate(storeName, id, data, queueOpts);
    return { success: true, local: true, data: (item as T) || undefined };
  } else {
    await localDelete(storeName, id, queueOpts);
    return { success: true, local: true };
  }
}
