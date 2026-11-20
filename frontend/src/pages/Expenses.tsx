import React, { useEffect, useState } from 'react';
import { Plus, Wallet, Calendar, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { formatLKR } from '../utils/currency';

const expenseCategories = [
  'Utilities (Electricity/Water)',
  'Shop Rent',
  'Staff Wages',
  'Logistics & Transport',
  'Packaging Materials',
  'Repairs & Maintenance',
  'Internet & Phone',
  'Cleaning & Sanitization',
  'Other Expenses'
];

export const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState(expenseCategories[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/expenses');
      const data = res.data;
      setExpenses(data?.expenses || []);
      setTotalAmount(Number(data?.total || 0));
    } catch {
      toast.error('Could not load expense records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/expenses', {
        category,
        description,
        amount: Number(amount),
        paymentMethod
      });
      setIsModalOpen(false);
      setDescription('');
      setAmount('');
      loadExpenses();
      toast.success('Expense recorded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to record expense');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operating Expenses</h1>
          <p className="text-sm text-slate-500 mt-1">Track day-to-day shop operational overhead and cash disbursements</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-2"
        >
          <Plus size={16} /> Record Expense
        </Button>
      </div>

      {/* Summary Stat Card */}
      <Card className="border-slate-200/90 shadow-2xs bg-gradient-to-tr from-slate-900 to-slate-800 text-white rounded-2xl overflow-hidden">
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-amber-400">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Total Recorded Outflow</p>
              <h2 className="text-3xl font-black mt-0.5" style={{ color: '#fcd34d' }}>{formatLKR(totalAmount)}</h2>
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {expenses.length} transaction{expenses.length === 1 ? '' : 's'} recorded
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table / List */}
      {isLoading ? (
        <LoadingState />
      ) : expenses.length === 0 ? (
        <EmptyState 
          icon={Wallet} 
          title="No expenses logged yet" 
          description="Log operating costs such as electricity bills, shop rent, transport, and supplies." 
          actionLabel="Record Expense" 
          onAction={() => setIsModalOpen(true)} 
        />
      ) : (
        <Card className="border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-0 divide-y divide-slate-100">
            {expenses.map((exp) => (
              <div key={exp.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm sm:text-base">{exp.description}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {exp.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} />
                      {new Date(exp.expenseDate || exp.createdAt).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <CreditCard size={13} />
                      Paid via {exp.paymentMethod || 'CASH'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-rose-600 block">
                    − {formatLKR(exp.amount)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Record Shop Operating Expense"
      >
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Category *</label>
            <select 
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
            >
              {expenseCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <Input 
            required 
            label="Expense Description" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="e.g. Monthly Electricity Bill (CEB)"
          />

          <Input 
            required 
            type="number" 
            min="0.01" 
            step="0.01" 
            label="Amount (LKR)" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            placeholder="e.g. 7500.00"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
            <select 
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={paymentMethod} 
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="CASH">Cash in Hand</option>
              <option value="CARD">Debit / Credit Card</option>
              <option value="BANK_TRANSFER">Bank Online Transfer</option>
              <option value="QR">LankaQR</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              Save Expense Outflow
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
