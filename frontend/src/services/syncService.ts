import { db } from '../db/offlineDb';
import { apiClient } from '../api/client';

export class SyncService {
  /**
   * Helper to execute critical synchronization inside a Web Lock
   * ensuring cross-tab and cross-event concurrency safety.
   */
  private static async withSyncLock(name: string, callback: () => Promise<void>) {
    if (!navigator.locks) {
      // Fallback if browser doesn't support Web Locks
      return callback();
    }
    return navigator.locks.request(`sync-lock-${name}`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock) {
        console.warn(`Sync lock for ${name} already held by another process.`);
        return;
      }
      await callback();
    });
  }

  static async queueOrder(businessId: string, payload: any, snapshot: any) {
    const clientTransactionId = payload.clientTransactionId;
    
    await db.transaction('rw', db.syncQueue, db.localOrders, async () => {
      // 1. Add to sync queue
      await db.syncQueue.add({
        clientTransactionId,
        businessId,
        operationType: 'CREATE_ORDER',
        payload,
        status: 'PENDING',
        attemptCount: 0,
        createdAt: new Date().toISOString()
      });

      // 2. Add to local orders for history/receipt generation
      await db.localOrders.add({
        clientTransactionId,
        businessId,
        tempOrderNumber: `OFF-${Date.now().toString().slice(-6)}`,
        grandTotal: payload.grandTotal,
        completedAt: new Date().toISOString(),
        status: 'PENDING_SYNC',
        snapshot
      });
    });
    
    // Attempt sync immediately in background
    SyncService.syncPendingOrders().catch(console.error);
  }

  static async syncPendingOrders() {
    if (!navigator.onLine) return;
    
    await this.withSyncLock('orders', async () => {
      const now = new Date().getTime();
      
      const pendingItems = await db.syncQueue
        .filter(item => 
          (item.status === 'PENDING' || item.status === 'FAILED') &&
          (!item.nextRetryAt || new Date(item.nextRetryAt).getTime() <= now)
        )
        .sortBy('createdAt');

      if (pendingItems.length === 0) return;

      for (const item of pendingItems) {
        await db.syncQueue.update(item.clientTransactionId, { status: 'SYNCING' });

        try {
          const response = await apiClient.post('/sync/orders', item.payload, {
            headers: { 'X-Business-Id': item.businessId }
          });
          
          // Success or ALREADY_SYNCED
          await db.transaction('rw', db.syncQueue, db.localOrders, async () => {
            await db.syncQueue.delete(item.clientTransactionId);
            const serverOrderId = response.data.data.id;
            await db.localOrders.update(item.clientTransactionId, { 
              status: 'SYNCED', 
              serverOrderId 
            });
          });

          // Refresh products to reconcile stock correctly now that sale synced
          SyncService.downloadProducts(item.businessId).catch(console.error);

        } catch (error: any) {
          const status = error.response?.status;
          
          let nextStatus: 'FAILED' | 'CONFLICT' = 'FAILED';
          let backoffMinutes = 0;

          if (status === 409 || status === 400) {
            // Permanent Conflict (stock issue, business membership revoked, etc)
            nextStatus = 'CONFLICT';
          } else if (status === 401 || status === 403) {
            // Permanent Conflict (unauthorized)
            nextStatus = 'CONFLICT';
          } else {
            // Temporary failure - Exponential Backoff
            // Attempt 1: 1 min, Attempt 2: 2 min, Attempt 3: 4 min, etc. (max 1 hour)
            const attempts = item.attemptCount + 1;
            backoffMinutes = Math.min(60, Math.pow(2, attempts - 1));
          }

          const nextRetryAt = backoffMinutes 
            ? new Date(Date.now() + backoffMinutes * 60000).toISOString()
            : null;

          await db.transaction('rw', db.syncQueue, db.localOrders, async () => {
            await db.syncQueue.update(item.clientTransactionId, {
              status: nextStatus,
              attemptCount: item.attemptCount + 1,
              lastAttemptAt: new Date().toISOString(),
              nextRetryAt,
              errorMessage: error.response?.data?.error?.message || error.message
            });
            
            if (nextStatus === 'CONFLICT') {
              await db.localOrders.update(item.clientTransactionId, { status: 'CONFLICT' });
            }
          });
        }
      }
    });
  }

  static async downloadProducts(businessId: string) {
    if (!navigator.onLine) return;

    await this.withSyncLock('products', async () => {
      try {
        let meta = await db.syncMetadata.get(businessId);
        const lastSync = meta?.lastProductSyncAt;

        // Fetch products updated after last sync
        const response = await apiClient.get('/products', {
          headers: { 'X-Business-Id': businessId },
          params: { 
            pageSize: 1000, 
            updatedAfter: lastSync || undefined 
          }
        });

        const serverProducts = response.data?.products || response.data?.data?.products || [];
        if (serverProducts.length === 0) {
          // Update sync timestamp even if empty
          await db.syncMetadata.put({ businessId, lastProductSyncAt: new Date().toISOString(), lastCategorySyncAt: meta?.lastCategorySyncAt || null });
          return;
        }
        
        const offlineProducts = serverProducts.map((p: any) => ({
          id: p.id,
          businessId,
          name: p.name,
          sku: p.sku || null,
          barcode: p.barcode || null,
          unit: p.unit,
          sellingPrice: p.sellingPrice,
          stockQuantity: p.stockQuantity,
          status: p.status,
          updatedAt: p.updatedAt
        }));

        await db.transaction('rw', db.products, db.syncMetadata, async () => {
          // Bulk put will insert or replace existing records (Incremental update)
          await db.products.bulkPut(offlineProducts);
          
          await db.syncMetadata.put({
            businessId,
            lastProductSyncAt: new Date().toISOString(),
            lastCategorySyncAt: meta?.lastCategorySyncAt || null,
            settings: meta?.settings || {}
          });
        });
      } catch (error) {
        console.error('Failed to sync products', error);
      }
    });
  }

  static async downloadSettings(businessId: string) {
    if (!navigator.onLine) return;
    try {
      const response = await apiClient.get('/settings', {
        headers: { 'X-Business-Id': businessId }
      });
      const settings = response.data?.id ? response.data : (response.data?.data || response.data);
      
      await db.transaction('rw', db.syncMetadata, async () => {
        let meta = await db.syncMetadata.get(businessId);
        await db.syncMetadata.put({
          businessId,
          lastProductSyncAt: meta?.lastProductSyncAt || null,
          lastCategorySyncAt: meta?.lastCategorySyncAt || null,
          settings
        });
      });
    } catch (error) {
      console.error('Failed to sync settings', error);
    }
  }

  static async downloadSubscription(businessId: string) {
    if (!navigator.onLine) return;
    try {
      const response = await apiClient.get('/subscription', {
        headers: { 'X-Business-Id': businessId }
      });
      // apiClient interceptor returns response.data, so response = { success, data, ... }
      const subscription = response.data;

      await db.transaction('rw', db.syncMetadata, async () => {
        const meta = await db.syncMetadata.get(businessId);
        await db.syncMetadata.put({
          businessId,
          lastProductSyncAt: meta?.lastProductSyncAt || null,
          lastCategorySyncAt: meta?.lastCategorySyncAt || null,
          settings: meta?.settings || {},
          subscription,
        });
      });
    } catch (error) {
      console.warn('Failed to sync subscription', error);
    }
  }
}
