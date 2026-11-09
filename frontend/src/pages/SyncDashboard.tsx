import { useEffect, useState } from 'react';
import { useNetwork } from '../state/NetworkContext';
import { db } from '../db/offlineDb';
import { useAuth } from '../state/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle, UploadCloud } from 'lucide-react';
import { formatLKR } from '../utils/currency';

export const SyncDashboard = () => {
  const { isOnline, isSyncing, syncOrders } = useNetwork();
  const { activeBusiness } = useAuth();
  
  const [stats, setStats] = useState({
    pending: 0,
    failed: 0,
    conflict: 0
  });

  const [queueItems, setQueueItems] = useState<any[]>([]);

  useEffect(() => {
    loadQueue();
    // Poll for updates if viewing this page
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [activeBusiness]);

  const loadQueue = async () => {
    if (!activeBusiness) return;
    
    const items = await db.syncQueue
      .where('businessId').equals(activeBusiness.id)
      .toArray();

    const pending = items.filter(i => i.status === 'PENDING' || i.status === 'SYNCING').length;
    const failed = items.filter(i => i.status === 'FAILED').length;
    const conflict = items.filter(i => i.status === 'CONFLICT').length;

    setStats({ pending, failed, conflict });
    
    // Join with local orders to get total values for display
    const enriched = await Promise.all(items.map(async item => {
      const order = await db.localOrders.get(item.clientTransactionId);
      return {
        ...item,
        grandTotal: order?.grandTotal || 0,
        tempOrderNumber: order?.tempOrderNumber || 'Unknown'
      };
    }));

    setQueueItems(enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Offline Sync Queue</h2>
          <p className="text-gray-500 text-sm mt-1">Manage offline transactions and synchronization.</p>
        </div>
        <div className="flex gap-2 items-center">
          {isOnline ? (
            <Badge variant="success" className="gap-1"><Cloud size={14} /> Online</Badge>
          ) : (
            <Badge variant="danger" className="gap-1"><CloudOff size={14} /> Offline</Badge>
          )}
          <Button 
            variant="primary" 
            onClick={syncOrders} 
            disabled={!isOnline || isSyncing || (stats.pending === 0 && stats.failed === 0)}
            className="gap-2"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} /> 
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <UploadCloud size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Sync</p>
              <h4 className="text-2xl font-bold text-gray-900 mt-1">{stats.pending}</h4>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-red-100 text-red-600">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Failed Retries</p>
              <h4 className="text-2xl font-bold text-gray-900 mt-1">{stats.failed}</h4>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Conflicts</p>
              <h4 className="text-2xl font-bold text-gray-900 mt-1">{stats.conflict}</h4>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {queueItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
              <CheckCircle size={48} className="text-green-500 mb-4 opacity-50" />
              <p>All offline transactions have been synchronized.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Local Ref</th>
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Total</th>
                  <th className="px-6 py-3 font-medium">Attempts</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Next Retry</th>
                  <th className="px-6 py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {queueItems.map((item) => (
                  <tr key={item.clientTransactionId}>
                    <td className="px-6 py-3 font-medium text-gray-900">{item.tempOrderNumber}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-gray-900">{formatLKR(item.grandTotal)}</td>
                    <td className="px-6 py-3 text-gray-600">{item.attemptCount}</td>
                    <td className="px-6 py-3">
                      <Badge variant={
                        item.status === 'PENDING' ? 'neutral' :
                        item.status === 'SYNCING' ? 'warning' :
                        item.status === 'CONFLICT' ? 'danger' :
                        'danger'
                      }>
                        {item.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-gray-500 text-xs">
                      {item.nextRetryAt ? new Date(item.nextRetryAt).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-6 py-3 text-red-600 max-w-[200px] truncate" title={item.errorMessage}>
                      {item.errorMessage || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
