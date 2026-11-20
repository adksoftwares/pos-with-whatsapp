import React, { useEffect, useState } from 'react';
import { Plus, PackagePlus, Trash2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { formatLKR } from '../utils/currency';

interface PurchaseLine {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

export const Purchases: React.FC = () => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [purchRes, suppRes, prodRes] = await Promise.all([
        apiClient.get('/purchases'),
        apiClient.get('/suppliers'),
        apiClient.get('/products', { params: { limit: 500, status: 'ACTIVE' } })
      ]);
      setPurchases(purchRes.data || []);
      setSuppliers(suppRes.data || []);
      setProducts(prodRes.data?.products || []);
    } catch {
      toast.error('Purchases data unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProductSelect = (prodId: string) => {
    setSelectedProduct(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod && prod.costPrice) {
      setUnitCost(Number(prod.costPrice).toString());
    }
  };

  const handleAddLine = () => {
    const prod = products.find((p) => p.id === selectedProduct);
    const qty = Number(quantity);
    const cost = Number(unitCost);

    if (!prod || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost < 0) {
      toast.error('Select a valid product, quantity, and cost price');
      return;
    }

    setLines([...lines, {
      productId: prod.id,
      productName: prod.name,
      quantity: qty,
      unitCost: cost
    }]);

    setSelectedProduct('');
    setQuantity('1');
    setUnitCost('');
  };

  const handleReceivePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }
    if (lines.length === 0) {
      toast.error('Add at least one purchase item line');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post('/purchases/receive', {
        supplierId: selectedSupplier,
        reference,
        items: lines
      });
      toast.success('Stock received into inventory; ledger updated');
      setIsModalOpen(false);
      setLines([]);
      setReference('');
      setSelectedSupplier('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record purchase receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCalculated = lines.reduce((acc, line) => acc + (line.quantity * line.unitCost), 0);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Invoices & Inward Stock</h1>
          <p className="text-sm text-slate-500 mt-1">Receive wholesale shipments from suppliers and increase product inventory counts</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-2"
        >
          <Plus size={16} /> Receive Inward Stock
        </Button>
      </div>

      {/* Purchases List */}
      {isLoading ? (
        <LoadingState />
      ) : purchases.length === 0 ? (
        <EmptyState 
          icon={PackagePlus} 
          title="No inward stock invoices recorded" 
          description="Log wholesale shipments from suppliers to keep your retail catalog stocked and cost-tracked." 
          actionLabel="Receive Stock" 
          onAction={() => setIsModalOpen(true)} 
        />
      ) : (
        <Card className="border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-0 divide-y divide-slate-100">
            {purchases.map((p) => (
              <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                      {p.supplier?.name || 'Wholesale Supplier'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={11} /> Received
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    <span>Invoice Ref: {p.reference || p.id}</span>
                    <span className="mx-2">•</span>
                    <span>{p.items?.length || 0} line item{p.items?.length === 1 ? '' : 's'}</span>
                    <span className="mx-2">•</span>
                    <span>{new Date(p.createdAt).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <div>
                  <span className="text-base font-bold text-slate-900 block">
                    {formatLKR(p.total)}
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
        title="Receive Supplier Stock Inward"
      >
        <form onSubmit={handleReceivePurchase} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Supplier *</label>
            <select 
              required 
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
              value={selectedSupplier} 
              onChange={(e) => setSelectedSupplier(e.target.value)}
            >
              <option value="">-- Choose Supplier / Distributor --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <Input 
            label="Supplier Invoice / Delivery Order (D.O.) Number" 
            value={reference} 
            onChange={(e) => setReference(e.target.value)} 
            placeholder="e.g. INV-CA-2026-99"
          />

          {/* Line Item Adder */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Add Products to Inward Shipment
            </label>
            
            <div>
              <select 
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                value={selectedProduct} 
                onChange={(e) => handleProductSelect(e.target.value)}
              >
                <option value="">-- Choose Product from Catalog --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Current Stock: {Number(p.stockQuantity)})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Input 
                type="number" 
                min="0.001" 
                step="any" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)} 
                placeholder="Qty received" 
              />
              <Input 
                type="number" 
                min="0" 
                step="0.01" 
                value={unitCost} 
                onChange={(e) => setUnitCost(e.target.value)} 
                placeholder="Cost/unit LKR" 
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleAddLine}
                className="col-span-2 sm:col-span-1"
              >
                <Plus size={15} /> Add Line
              </Button>
            </div>
          </div>

          {/* Staged Lines */}
          {lines.length > 0 && (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {lines.map((item, idx) => (
                <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{item.productName}</span>
                    <span className="text-slate-500">{item.quantity} units @ {formatLKR(item.unitCost)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900">{formatLKR(item.quantity * item.unitCost)}</span>
                    <button 
                      type="button" 
                      onClick={() => setLines(lines.filter((_, i) => i !== idx))} 
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            <div>
              <span className="text-xs text-slate-500 block">Total Inward Value</span>
              <span className="text-lg font-black text-slate-900">{formatLKR(totalCalculated)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting} disabled={lines.length === 0} className="bg-blue-600 hover:bg-blue-700">
                Confirm & Receive Stock
              </Button>
            </div>
          </div>
        </form>
      </Modal>

    </div>
  );
};
