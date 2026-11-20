import React, { useEffect, useState } from 'react';
import { History, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';
import { Card, CardContent } from '../components/ui/Card';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';

export const InventoryLedger: React.FC = () => {
  const [movements, setMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/inventory/movements');
      setMovements(res.data || []);
    } catch {
      toast.error('Inventory ledger unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, []);

  const getTypeBadge = (type: string, _qty?: number) => {
    switch (type) {
      case 'SALE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <ArrowDownRight size={12} /> SALE
          </span>
        );
      case 'RETURN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <ArrowUpRight size={12} /> RETURN
          </span>
        );
      case 'PURCHASE':
      case 'INWARD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ArrowUpRight size={12} /> RESTOCK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <ArrowLeftRight size={12} /> {type || 'ADJUST'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventory Ledger & Stock Audit</h1>
        <p className="text-sm text-slate-500 mt-1">Audit log of all stock adjustments, sales deductions, returns, and inward purchases</p>
      </div>

      {/* Movements Table */}
      {isLoading ? (
        <LoadingState />
      ) : movements.length === 0 ? (
        <EmptyState 
          icon={History} 
          title="No stock movements recorded" 
          description="Stock transactions generated from POS sales, inventory adjustments, and returns will appear here." 
        />
      ) : (
        <Card className="border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-0 divide-y divide-slate-100">
            {movements.map((m) => {
              const qtyNum = Number(m.quantity);
              const isPositive = qtyNum > 0;
              return (
                <div key={m.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
                        {m.product?.name || m.productId}
                      </span>
                      {getTypeBadge(m.type, qtyNum)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <span>{m.note || m.referenceType || 'Stock operation'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(m.createdAt).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className={`text-base font-extrabold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isPositive ? '+' : ''}{qtyNum} {m.product?.unit || 'units'}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

    </div>
  );
};
