import Dexie, { type Table } from 'dexie';

export interface OfflineProduct {
  id: string;
  businessId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  sellingPrice: number;
  stockQuantity: number;
  status: string;
  updatedAt: string;
}

export interface OfflineSyncQueueItem {
  clientTransactionId: string;
  businessId: string;
  operationType: 'CREATE_ORDER';
  payload: any; // The full JSON payload to send to /api/v1/sync
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT';
  attemptCount: number;
  lastAttemptAt?: string;
  nextRetryAt?: string | null;
  errorMessage?: string;
  createdAt: string;
}

// Used to generate historical snapshot local views for printing
export interface LocalOrder {
  clientTransactionId: string;
  businessId: string;
  tempOrderNumber: string;
  grandTotal: number;
  completedAt: string;
  status: 'PENDING_SYNC' | 'SYNCED' | 'CONFLICT';
  serverOrderId?: string;
  snapshot: any; // Full receipt snapshot
}

export interface SyncMetadata {
  businessId: string;
  lastProductSyncAt: string | null;
  lastCategorySyncAt: string | null;
  settings?: any; // The offline cache of BusinessSettings
  subscription?: any; // The offline cache of SubscriptionInfo (Phase 19)
}

export class POSDatabase extends Dexie {
  products!: Table<OfflineProduct, string>;
  syncQueue!: Table<OfflineSyncQueueItem, string>;
  localOrders!: Table<LocalOrder, string>;
  syncMetadata!: Table<SyncMetadata, string>;
  
  constructor() {
    super('POSOfflineDatabase');
    
    // V1 Schema
    this.version(1).stores({
      products: 'id, businessId, barcode, sku, name, status',
      syncQueue: 'clientTransactionId, businessId, status',
      localOrders: 'clientTransactionId, businessId, status, completedAt'
    });

    // V2 Schema - added syncMetadata
    this.version(2).stores({
      products: 'id, businessId, barcode, sku, name, status',
      syncQueue: 'clientTransactionId, businessId, status, nextRetryAt',
      localOrders: 'clientTransactionId, businessId, status, completedAt',
      syncMetadata: 'businessId'
    }).upgrade(tx => {
      // Safely apply nextRetryAt to existing queue items if any
      return tx.table('syncQueue').toCollection().modify(item => {
        item.nextRetryAt = null;
      });
    });
  }
}

export const db = new POSDatabase();
