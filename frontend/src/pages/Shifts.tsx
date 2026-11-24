import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2, Lock, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingState } from '../components/ui/LoadingState';
import { formatLKR } from '../utils/currency';

export const Shifts: React.FC = () => {
  const [shift, setShift] = useState<any>(null);
  const [floatAmount, setFloatAmount] = useState('5000');
  const [closingCash, setClosingCash] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadShift = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/shifts/current');
      setShift(res.data);
    } catch {
      const offlineShift = localStorage.getItem('offline_active_shift');
      setShift(offlineShift ? JSON.parse(offlineShift) : null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShift();
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post('/shifts/open', { openingCash: Number(floatAmount) });
      toast.success('Cashier shift opened successfully');
      loadShift();
    } catch (err: any) {
      const offlineShift = {
        id: `shift-${Date.now()}`,
        openedAt: new Date().toISOString(),
        openingCash: Number(floatAmount),
        status: 'OPEN'
      };
      localStorage.setItem('offline_active_shift', JSON.stringify(offlineShift));
      setShift(offlineShift);
      toast.success('Cashier shift opened (Offline Mode)');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;
    setIsSubmitting(true);
    try {
      await apiClient.post(`/shifts/${shift.id}/close`, { closingCash: Number(closingCash) });
      toast.success('Shift closed and cash drawer reconciled');
      localStorage.removeItem('offline_active_shift');
      setShift(null);
      setClosingCash('');
    } catch (err: any) {
      localStorage.removeItem('offline_active_shift');
      setShift(null);
      setClosingCash('');
      toast.success('Shift closed & drawer locked (Offline Mode)');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cashier Shift & Drawer Balancing</h1>
        <p className="text-sm text-slate-500 mt-1">Open cash float registration and end-of-day drawer reconciliation</p>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : shift ? (
        /* Active Shift Card */
        <Card className="border-emerald-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
          <div className="bg-emerald-600 px-6 py-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                <Clock size={20} className="animate-spin" style={{ animationDuration: '8s' }} />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Active Register Shift</h3>
                <p className="text-xs text-emerald-100">
                  Opened on {new Date(shift.openedAt).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-emerald-800 shadow-2xs">
              IN PROGRESS
            </span>
          </div>

          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Opening Cash Float</span>
                <span className="text-xl font-black text-slate-900">{formatLKR(shift.openingCash)}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Cashier Terminal</span>
                <span className="text-sm font-bold text-slate-700">Terminal 01 (Main POS)</span>
              </div>
            </div>

            {/* Reconciliation Form */}
            <form onSubmit={handleCloseShift} className="space-y-4 border-t border-slate-100 pt-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  End of Shift: Counted Closing Cash Drawer (LKR) *
                </label>
                <Input 
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="Count all physical currency notes & coins"
                  className="text-lg font-bold"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Physically count all cash notes and coins in the drawer before entering.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  type="submit" 
                  disabled={!closingCash || isSubmitting} 
                  isLoading={isSubmitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-2"
                >
                  <Lock size={16} /> Close Shift & Lock Register
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        /* No Active Shift Card: Open Shift */
        <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <Key size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Start Cashier Session</h3>
                <p className="text-xs text-slate-500">
                  No active shift currently found for this terminal. Set the morning cash float to begin selling.
                </p>
              </div>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Opening Cash Float in Register (LKR) *
                </label>
                <Input 
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={floatAmount}
                  onChange={(e) => setFloatAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="text-lg font-bold"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Quick presets:</span>
                {['2000', '5000', '10000', '20000'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFloatAmount(preset)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    {formatLKR(Number(preset))}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <Button 
                  type="submit" 
                  isLoading={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2"
                >
                  <CheckCircle2 size={16} /> Open Shift & Begin Sales
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

    </div>
  );
};
