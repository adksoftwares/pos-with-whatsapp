import React, { createContext, useContext, useState, useEffect } from 'react';
import { SyncService } from '../services/syncService';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

interface NetworkContextType {
  isOnline: boolean;
  isSyncing: boolean;
  syncOrders: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isSyncing: false,
  syncOrders: async () => {},
});

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const { activeBusiness } = useAuth();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored. Syncing...');
      syncOrders();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('You are offline. Sales will be saved to your device.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial background cache fetch if online
    if (navigator.onLine && activeBusiness) {
      SyncService.downloadSettings(activeBusiness.id);
      SyncService.downloadSubscription(activeBusiness.id);
      SyncService.downloadProducts(activeBusiness.id);
      syncOrders();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeBusiness]);

  const syncOrders = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      await SyncService.syncPendingOrders();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <NetworkContext.Provider value={{ isOnline, isSyncing, syncOrders }}>
      {children}
      {!isOnline && (
        <div className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-yellow-900 text-center py-2 px-4 text-sm font-medium z-50">
          You are offline. Sales will be saved on this device and synchronized when the connection returns.
        </div>
      )}
    </NetworkContext.Provider>
  );
};
