import React, { useEffect, useState } from 'react';
import { RotateCcw, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { formatLKR } from '../utils/currency';

export const Returns: React.FC = () => {
  const [returns, setReturns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderQuery, setOrderQuery] = useState(new URLSearchParams(window.location.search).get('order') || '');
  const [reason, setReason] = useState('Customer exchange / return');
  const [restock, setRestock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReturns = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/returns');
      setReturns(res.data || []);
    } catch {
      toast.error('Could not load returns history');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post('/returns', {
        orderId: orderQuery.trim(),
        reason,
        restock
      });
      toast.success('Return processed and inventory updated');
      setIsModalOpen(false);
      setOrderQuery('');
      loadReturns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to process return');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Returns & Refunds</h1>
          <p className="text-sm text-slate-500 mt-1">Process customer invoice returns and automatically restock returned goods</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-2"
        >
          <RotateCcw size={16} /> Process Sale Return
        </Button>
      </div>

      {/* Returns List */}
      {isLoading ? (
        <LoadingState />
      ) : returns.length === 0 ? (
        <EmptyState 
          icon={RotateCcw} 
          title="No sales returns logged" 
          description="When customers return items with an invoice number, refunds and inventory adjustments are tracked here." 
          actionLabel="Process Return" 
          onAction={() => setIsModalOpen(true)} 
        />
      ) : (
        <Card className="border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-0 divide-y divide-slate-100">
            {returns.map((r) => (
              <div key={r.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                      {r.order?.orderNumber || r.orderId}
                    </span>
                    {r.restocked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={11} /> Restocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        No Restock
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    <span>Reason: {r.reason}</span>
                    <span className="mx-2">•</span>
                    <span>{new Date(r.createdAt).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <div>
                  <span className="text-base font-bold text-slate-900 block">
                    Refunded: {formatLKR(r.amount)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Process Return Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Process Customer Sale Return"
      >
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <Input 
            required 
            label="Invoice / Order Number *" 
            value={orderQuery} 
            onChange={(e) => setOrderQuery(e.target.value)} 
            placeholder="e.g. INV-1763232499118"
          />

          <Input 
            label="Return Reason" 
            value={reason} 
            onChange={(e) => setReason(e.target.value)} 
            placeholder="e.g. Damaged seal / Wrong item purchased"
          />

          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500" 
              checked={restock} 
              onChange={(e) => setRestock(e.target.checked)} 
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-800 block">Add returned items back to stock quantity</span>
              <span className="text-slate-500">Inventory transactions will be automatically generated and store stock incremented.</span>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              Confirm & Refund Sale
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
