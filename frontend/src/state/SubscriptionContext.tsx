import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from './AuthContext';
import { db } from '../db/offlineDb';

export interface SubscriptionInfo {
  planCode: string;
  planName: string;
  status: string;
  productLimit: number;
  productCount: number;
  remaining: number;
  startsAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  isPro: boolean;
  isFree: boolean;
  price: number;
  currency: string;
  billingDays: number | null;
}

interface SubscriptionContextType {
  subscription: SubscriptionInfo | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  can: (feature: 'ADVANCED_REPORTS' | 'PRO_FEATURES' | 'EXTENDED_PRODUCT_MANAGEMENT') => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const DEFAULT_FREE: SubscriptionInfo = {
  planCode: 'FREE',
  planName: 'Free Plan',
  status: 'ACTIVE',
  productLimit: 10,
  productCount: 0,
  remaining: 10,
  startsAt: null,
  expiresAt: null,
  isExpired: false,
  isPro: false,
  isFree: true,
  price: 0,
  currency: 'LKR',
  billingDays: null,
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeBusiness, token } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeBusiness || !token) return;
    setIsLoading(true);
    try {
      // apiClient interceptor returns response.data, so res = { success, message, data }
      const res = await apiClient.get('/subscription') as any;
      const data = res.data as SubscriptionInfo;
      setSubscription(data);
      // Cache in IndexedDB for offline use
      try {
        const meta = await db.syncMetadata.get(activeBusiness.id);
        await db.syncMetadata.put({
          businessId: activeBusiness.id,
          lastProductSyncAt: meta?.lastProductSyncAt || null,
          lastCategorySyncAt: meta?.lastCategorySyncAt || null,
          settings: meta?.settings || {},
          subscription: data,
        });
      } catch {
        // ignore IndexedDB errors
      }
    } catch {
      // Offline fallback: load from IndexedDB cache
      try {
        const meta = await db.syncMetadata.get(activeBusiness.id);
        if (meta?.subscription) {
          // Conservative offline policy: if expired by clock, treat as expired
          const cached = { ...(meta.subscription as SubscriptionInfo) };
          if (cached.expiresAt && new Date() >= new Date(cached.expiresAt)) {
            cached.isExpired = true;
            cached.isPro = false;
            cached.isFree = true;
            cached.status = 'EXPIRED';
          }
          setSubscription(cached);
        } else {
          setSubscription(DEFAULT_FREE);
        }
      } catch {
        setSubscription(DEFAULT_FREE);
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeBusiness, token]);

  useEffect(() => {
    if (activeBusiness && token) {
      refresh();
    } else {
      setSubscription(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusiness?.id, token]);

  const can = useCallback((feature: 'ADVANCED_REPORTS' | 'PRO_FEATURES' | 'EXTENDED_PRODUCT_MANAGEMENT') => {
    if (!subscription) return false;
    if (subscription.isExpired) return false;
    switch (feature) {
      case 'PRO_FEATURES':
      case 'ADVANCED_REPORTS':
      case 'EXTENDED_PRODUCT_MANAGEMENT':
        return subscription.isPro;
      default:
        return false;
    }
  }, [subscription]);

  return (
    <SubscriptionContext.Provider value={{ subscription, isLoading, refresh, can }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within SubscriptionProvider');
  return context;
};
