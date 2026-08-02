/**
 * Step-by-Step Sequential Offline Sync Engine
 * Manages queued offline modifications (shops created, orders placed, wishlist edits)
 * and submits them one by one, awaiting each API response before proceeding to the next item.
 */

import { offlineDB } from './indexed-db';
import { resolveApiUrl, getAuthToken } from '../utils';

export interface PendingAction {
  id: string;
  title: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  payload: any;
  createdAt: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

/**
 * Queue a new offline modification for step-by-step server submission
 */
export async function queuePendingAction(action: Omit<PendingAction, 'id' | 'createdAt' | 'status'>): Promise<void> {
  const newAction: PendingAction = {
    ...action,
    id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  const db = await (offlineDB as any).getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_actions', 'readwrite');
    tx.objectStore('pending_actions').put(newAction);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve all pending offline actions queued in IndexedDB
 */
export async function getPendingActions(): Promise<PendingAction[]> {
  try {
    return await offlineDB.getAll<PendingAction>('pending_actions');
  } catch {
    return [];
  }
}

/**
 * Remove a specific pending action from the queue
 */
export async function deletePendingAction(id: string): Promise<void> {
  const db = await (offlineDB as any).getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_actions', 'readwrite');
    tx.objectStore('pending_actions').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Process pending offline actions ONE BY ONE, step by step, awaiting API response
 */
export async function processPendingActionsStepByStep(
  onProgress?: (step: number, total: number, currentAction: PendingAction, status: 'syncing' | 'success' | 'failed', msg?: string) => void
): Promise<{ totalProcessed: number; successCount: number; failedCount: number }> {
  const actions = await getPendingActions();
  if (actions.length === 0) return { totalProcessed: 0, successCount: 0, failedCount: 0 };

  const token = getAuthToken();
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    onProgress?.(i + 1, actions.length, action, 'syncing', `Submitting ${action.title}...`);

    try {
      const targetUrl = resolveApiUrl(action.endpoint);
      const res = await fetch(targetUrl, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(action.payload),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Server error');
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      // Success! Await complete response before moving to next item
      await res.json().catch(() => ({}));
      await deletePendingAction(action.id);
      successCount++;
      onProgress?.(i + 1, actions.length, action, 'success', `Synced ${action.title}`);
    } catch (err: any) {
      failedCount++;
      const errorMessage = err?.message || 'Sync failed';
      console.warn(`Pending action ${action.id} failed:`, err);
      onProgress?.(i + 1, actions.length, action, 'failed', errorMessage);
    }
  }

  return {
    totalProcessed: actions.length,
    successCount,
    failedCount,
  };
}
