/**
 * High-Performance Sequential Offline Sync Queue Engine
 * 
 * Manages queued offline actions (Wishlist additions, Shop creation/updates, Orders placed, Product/Category edits)
 * and processes them sequentially (FIFO) one-by-one, halting immediately if any operation fails.
 */

import { offlineDB } from './indexed-db';
import { resolveApiUrl, getAuthToken } from '../utils';

export interface SyncQueueItem {
  id: string;
  queueId: string; // e.g. "001", "002"
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'Product' | 'Category' | 'Subcategory' | 'Customer' | 'Shop' | 'Order' | 'Wishlist' | string;
  entityId: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  payload: any;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  title: string;
}

// Backward compatibility interface
export type PendingAction = SyncQueueItem;

/**
 * Format queue ID as 3-digit padded string (001, 002, 003...)
 */
function formatQueueId(num: number): string {
  return String(num).padStart(3, '0');
}

/**
 * Retrieve all items in the SyncQueue sorted by creation/queue order
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  if (typeof window === 'undefined') return [];
  try {
    const items = await offlineDB.getAll<SyncQueueItem>('sync_queue');
    return items.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  } catch (err) {
    console.warn('Failed to fetch sync queue from IndexedDB:', err);
    return [];
  }
}

// Backward compatibility helper
export const getPendingActions = getSyncQueue;

/**
 * Queue a new offline modification for step-by-step sequential submission
 */
export async function addToSyncQueue(
  actionData: Omit<SyncQueueItem, 'id' | 'queueId' | 'status' | 'retryCount' | 'createdAt'>
): Promise<SyncQueueItem> {
  const existingQueue = await getSyncQueue();
  const nextNum = existingQueue.length + 1;
  const queueId = formatQueueId(nextNum);
  
  const newItem: SyncQueueItem = {
    ...actionData,
    id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    queueId,
    status: 'PENDING',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };

  const db = await offlineDB.getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sync_queue', 'pending_actions'], 'readwrite');
    tx.objectStore('sync_queue').put(newItem);
    tx.objectStore('pending_actions').put(newItem);
    tx.oncomplete = () => {
      // Dispatch window event so components can refresh queue state instantly
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('matrices-sync-queue-updated'));
      }
      resolve(newItem);
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Backward compatibility alias
export async function queuePendingAction(action: any): Promise<void> {
  await addToSyncQueue({
    operation: action.method === 'POST' ? 'CREATE' : action.method === 'DELETE' ? 'DELETE' : 'UPDATE',
    entity: action.entity || 'General',
    entityId: action.entityId || 'N/A',
    endpoint: action.endpoint,
    method: action.method || 'POST',
    payload: action.payload,
    title: action.title || 'Offline Operation',
  });
}

/**
 * Update an existing sync queue item status or error message
 */
export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await offlineDB.getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sync_queue', 'pending_actions'], 'readwrite');
    tx.objectStore('sync_queue').put(item);
    tx.objectStore('pending_actions').put(item);
    tx.oncomplete = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('matrices-sync-queue-updated'));
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Remove a specific item from the queue
 */
export async function deleteSyncQueueItem(id: string): Promise<void> {
  const db = await offlineDB.getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sync_queue', 'pending_actions'], 'readwrite');
    tx.objectStore('sync_queue').delete(id);
    tx.objectStore('pending_actions').delete(id);
    tx.oncomplete = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('matrices-sync-queue-updated'));
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// Backward compatibility alias
export const deletePendingAction = deleteSyncQueueItem;

/**
 * Clear all items in the queue
 */
export async function clearSyncQueue(): Promise<void> {
  const db = await offlineDB.getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sync_queue', 'pending_actions'], 'readwrite');
    tx.objectStore('sync_queue').clear();
    tx.objectStore('pending_actions').clear();
    tx.oncomplete = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('matrices-sync-queue-updated'));
      }
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export interface PushProcessProgressCallback {
  (
    step: number,
    total: number,
    item: SyncQueueItem,
    status: 'PROCESSING' | 'SUCCESS' | 'FAILED',
    message?: string
  ): void;
}

/**
 * Process queue sequentially FIFO:
 * 1. Executes oldest non-SUCCESS item first.
 * 2. Never sends multiple requests in parallel.
 * 3. On failure, HALTS IMMEDIATELY and preserves queue order.
 */
export async function processSyncQueueSequential(
  onProgress?: PushProcessProgressCallback
): Promise<{
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  stoppedAt?: SyncQueueItem;
  errorReason?: string;
}> {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    throw new Error('Device is offline. Please connect to internet to push changes.');
  }

  const queue = await getSyncQueue();
  // Filter for items that need pushing (PENDING or FAILED)
  const pendingItems = queue.filter((item) => item.status === 'PENDING' || item.status === 'FAILED');

  if (pendingItems.length === 0) {
    return { totalProcessed: 0, successCount: 0, failedCount: 0 };
  }

  const token = getAuthToken();
  let successCount = 0;

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    
    // Mark item as PROCESSING
    item.status = 'PROCESSING';
    await updateSyncQueueItem(item);
    onProgress?.(i + 1, pendingItems.length, item, 'PROCESSING', `Sending ${item.operation} ${item.entity} (${item.entityId})...`);

    try {
      const targetUrl = resolveApiUrl(item.endpoint);
      const res = await fetch(targetUrl, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: item.payload ? JSON.stringify(item.payload) : undefined,
      });

      const resJson = await res.json().catch(() => ({}));

      if (!res.ok) {
        let serverError = resJson.message || resJson.error || resJson.reason || (typeof resJson === 'string' ? resJson : '');
        
        // Clean error message
        if (!serverError || serverError.includes('<!DOCTYPE')) {
          serverError = `HTTP Server Error ${res.status}`;
        }

        throw new Error(serverError);
      }

      // Handle shop temp ID mapping replacement if a shop was created
      const isShopCreate = item.endpoint.includes('/shops/create') || item.entity === 'Customer' || item.entity === 'Shop';
      const realShopId = resJson.shop?.shopId || resJson.shopId;
      const oldTempShopId = item.entityId || item.payload?.shopId;
      if (isShopCreate && realShopId && oldTempShopId && oldTempShopId.startsWith('TMP_')) {
        await resolveShopIdMapping(oldTempShopId, realShopId);
      }

      // Handle order sync status update if an order was created
      const isOrderCreate = item.endpoint.includes('/orders/create') || item.entity === 'Order';
      if (isOrderCreate) {
        await markOrderSyncedSuccess(item.entityId, resJson.order);
      }

      // Success! Mark item as SUCCESS
      item.status = 'SUCCESS';
      item.errorMessage = undefined;
      await updateSyncQueueItem(item);
      successCount++;
      onProgress?.(i + 1, pendingItems.length, item, 'SUCCESS', `Successfully pushed ${item.title}`);
    } catch (err: any) {
      const reason = err?.message || 'Network submission error';
      item.status = 'FAILED';
      item.errorMessage = reason;
      item.retryCount = (item.retryCount || 0) + 1;
      await updateSyncQueueItem(item);

      onProgress?.(i + 1, pendingItems.length, item, 'FAILED', reason);

      // CRITICAL REQUIREMENT: Stop processing immediately on first failure
      return {
        totalProcessed: i + 1,
        successCount,
        failedCount: 1,
        stoppedAt: item,
        errorReason: reason,
      };
    }
  }

  return {
    totalProcessed: pendingItems.length,
    successCount,
    failedCount: 0,
  };
}

// Backward compatibility alias
export const processPendingActionsStepByStep = async (
  legacyOnProgress?: (step: number, total: number, currentAction: any, status: any, msg?: string) => void
) => {
  return processSyncQueueSequential((step, total, item, status, msg) => {
    const legacyStatus = status === 'PROCESSING' ? 'syncing' : status === 'SUCCESS' ? 'success' : 'failed';
    legacyOnProgress?.(step, total, item, legacyStatus, msg);
  });
};

/**
 * Retry push starting from the failed item
 */
export async function retrySyncQueue(
  onProgress?: PushProcessProgressCallback
): Promise<{
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  stoppedAt?: SyncQueueItem;
  errorReason?: string;
}> {
  const queue = await getSyncQueue();
  const failedItems = queue.filter((item) => item.status === 'FAILED');

  for (const item of failedItems) {
    item.status = 'PENDING';
    item.errorMessage = undefined;
    await updateSyncQueueItem(item);
  }

  return processSyncQueueSequential(onProgress);
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT GENERATORS (JSON, CSV, PDF)
// ─────────────────────────────────────────────────────────────────────────────

export function downloadFailureReportJSON(userName: string, queue: SyncQueueItem[]): void {
  const failedItems = queue.filter((item) => item.status === 'FAILED');
  const reportData = {
    title: 'Offline Changes Failure Report',
    user: userName || 'Salesrep',
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    totalChanges: queue.length,
    successCount: queue.filter((i) => i.status === 'SUCCESS').length,
    failedCount: failedItems.length,
    failedItems: failedItems.map((item, idx) => ({
      index: idx + 1,
      queueId: item.queueId,
      operation: `${item.operation} ${item.entity.toUpperCase()}`,
      entity: item.entity,
      entityId: item.entityId,
      endpoint: item.endpoint,
      reason: item.errorMessage || 'Unknown error',
      createdAt: item.createdAt,
    })),
  };

  const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `offline_changes_report_${reportData.date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadFailureReportCSV(userName: string, queue: SyncQueueItem[]): void {
  const failedItems = queue.filter((item) => item.status === 'FAILED');
  const date = new Date().toISOString().split('T')[0];

  let csvContent = `OFFLINE CHANGES REPORT\n`;
  csvContent += `User,${userName || 'Salesrep'}\n`;
  csvContent += `Date,${date}\n`;
  csvContent += `Total Changes,${queue.length}\n`;
  csvContent += `Success,${queue.filter((i) => i.status === 'SUCCESS').length}\n`;
  csvContent += `Failed,${failedItems.length}\n\n`;

  csvContent += `Index,Queue ID,Operation,Entity,Entity ID,Reason,Created At\n`;

  failedItems.forEach((item, idx) => {
    const cleanReason = (item.errorMessage || 'Unknown error').replace(/"/g, '""');
    csvContent += `"${idx + 1}","${item.queueId}","${item.operation}","${item.entity}","${item.entityId}","${cleanReason}","${item.createdAt}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `offline_changes_report_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadFailureReportPDF(userName: string, queue: SyncQueueItem[]): void {
  const failedItems = queue.filter((item) => item.status === 'FAILED');
  const date = new Date().toISOString().split('T')[0];
  const successCount = queue.filter((i) => i.status === 'SUCCESS').length;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const itemsHtml = failedItems
    .map(
      (item, idx) => `
    <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; background: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #edf2f7; padding-bottom: 8px; margin-bottom: 8px;">
        <span style="font-weight: 800; color: #0f172a; font-size: 14px;">#${idx + 1} &nbsp; ${item.operation} ${item.entity.toUpperCase()}</span>
        <span style="font-family: monospace; font-size: 12px; background: #fee2e2; color: #991b1b; padding: 2px 8px; rounded-radius: 4px; font-weight: 700;">ID: ${item.entityId}</span>
      </div>
      <div style="font-size: 13px; color: #475569; margin-top: 4px;">
        <strong>Reason:</strong> <span style="color: #dc2626; font-weight: 600;">${item.errorMessage || 'Unknown error'}</span>
      </div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 6px; font-family: monospace;">
        Queue ID: ${item.queueId} | Created: ${new Date(item.createdAt).toLocaleString()}
      </div>
    </div>
  `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Offline Changes Report - ${date}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0f172a; background: #f8fafc; }
          .card { background: #ffffff; border-radius: 16px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 800px; margin: 0 auto; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 22px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f1f5f9; padding: 16px; border-radius: 12px; margin-bottom: 24px; font-size: 13px; }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
          .meta-val { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px; }
          @media print {
            body { background: #fff; padding: 0; }
            .card { box-shadow: none; border: none; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div>
              <h1 class="title">Offline Changes Report</h1>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Magnum Mobile Catalogue Platform</div>
            </div>
            <button onclick="window.print()" style="padding: 8px 16px; background: #0f172a; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">Print / Save PDF</button>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">User</span>
              <span class="meta-val">${userName || 'Salesrep'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date</span>
              <span class="meta-val">${date}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Total Changes</span>
              <span class="meta-val">${queue.length}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Success / Failed</span>
              <span class="meta-val" style="color: ${failedItems.length > 0 ? '#dc2626' : '#16a34a'};">${successCount} / ${failedItems.length}</span>
            </div>
          </div>

          <h3 style="font-size: 14px; font-weight: 900; text-transform: uppercase; color: #334155; margin-bottom: 12px;">
            Failed Queue Items (${failedItems.length})
          </h3>

          ${itemsHtml || '<div style="color: #64748b; font-size: 13px;">No failed operations.</div>'}
        </div>
        <script>
          setTimeout(() => { window.print(); }, 500);
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Resolves temporary shop ID (TMP_xxxx) to real live shop ID (e.g. SHOP0042)
 * across sync queue and local IndexedDB stores.
 */
async function resolveShopIdMapping(oldTempId: string, realShopId: string) {
  if (!oldTempId || !realShopId || oldTempId === realShopId) return;

  try {
    // 1. Update remaining items in IndexedDB sync_queue
    const queue = await offlineDB.getAll<SyncQueueItem>('sync_queue');
    for (const item of queue) {
      if (item.payload && item.payload.shop && item.payload.shop.shopId === oldTempId) {
        item.payload.shop.shopId = realShopId;
        await updateSyncQueueItem(item);
      }
    }

    // 2. Update local orders in IndexedDB orders store
    const localOrders = await offlineDB.getAll<any>('orders');
    for (const ord of localOrders) {
      if (ord.shop && ord.shop.shopId === oldTempId) {
        ord.shop.shopId = realShopId;
        await offlineDB.upsert('orders', ord);
      }
    }

    // 3. Update local shop in IndexedDB shops store
    const localShops = await offlineDB.getAll<any>('shops');
    const tempShop = localShops.find((s: any) => String(s.shopId || s.id) === String(oldTempId));
    if (tempShop) {
      await offlineDB.deleteById('shops', oldTempId);
      const updatedShop = { ...tempShop, id: realShopId, shopId: realShopId };
      await offlineDB.upsert('shops', updatedShop);
    }
  } catch (err) {
    console.warn('Error resolving temp shop ID mapping during sync:', err);
  }
}

/**
 * Marks an order in local IndexedDB as synced with server returned live order ID.
 */
async function markOrderSyncedSuccess(localOrderId: string, serverOrder: any) {
  try {
    const localOrders = await offlineDB.getAll<any>('orders');
    const target = localOrders.find((o: any) => String(o.id) === String(localOrderId) || String(o.orderId) === String(localOrderId));
    if (target) {
      target.isSynced = true;
      target.status = 'synced';
      if (serverOrder && serverOrder.orderId) {
        target.liveOrderId = serverOrder.orderId;
        target.orderId = serverOrder.orderId;
      }
      await offlineDB.upsert('orders', target);
    }
  } catch (err) {
    console.warn('Error marking order synced in local DB:', err);
  }
}

