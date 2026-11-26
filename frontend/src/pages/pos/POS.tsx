import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { 
  ScanLine, Search, Plus, Minus, Trash2, ShoppingCart, 
  PauseCircle, PlayCircle, Clock, CreditCard, User
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { formatLKR } from '../../utils/currency';
import toast from 'react-hot-toast';
import { BarcodeScanner } from '../../components/scanner/BarcodeScanner';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { CheckoutModal } from './CheckoutModal';
import { ReceiptPreviewModal } from '../../components/ReceiptPreviewModal';
import { useNetwork } from '../../state/NetworkContext';
import { db } from '../../db/offlineDb';
import { useAuth } from '../../state/AuthContext';
import { seedDemoDataToDexie } from '../../utils/offlineDemoSeed';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sellingPrice: number;
  stockQuantity: number;
  unit: string;
  status: string;
  company?: string;
  categoryId?: string;
}

interface CartItem extends Product {
  cartItemId: string;
  quantity: number;
  lineDiscount: number;
  lineDiscountPercent?: number;
  lineSubtotal: number;
}

interface HeldBill {
  id: string;
  billNumber: string;
  heldAt: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountMode?: 'AMOUNT' | 'PERCENT';
  total: number;
  totalItems: number;
}

export const POS = () => {
  const { isOnline } = useNetwork();
  const { activeBusiness, user } = useAuth();
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('pos_draft_cart');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      localStorage.removeItem('pos_draft_cart');
      return [];
    }
  });

  // Held Bills state (Food City Style Park / Suspend)
  const [heldBills, setHeldBills] = useState<HeldBill[]>(() => {
    try {
      const saved = localStorage.getItem('pos_held_bills');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityDraft, setQuantityDraft] = useState('1');
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRecallModalOpen, setIsRecallModalOpen] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  
  const [discountMode, setDiscountMode] = useState<'AMOUNT' | 'PERCENT'>(() => localStorage.getItem('pos_draft_discount_mode') === 'PERCENT' ? 'PERCENT' : 'AMOUNT');
  const [discount, setDiscount] = useState<number>(() => {
    const saved = Number(localStorage.getItem('pos_draft_discount') || 0);
    return Number.isFinite(saved) && saved > 0 ? saved : 0;
  });

  // Quick cash tender helper state
  const [cashTendered, setCashTendered] = useState<string>('');
  
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load catalog on mount
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const pRes = await apiClient.get('/products', { params: { limit: 50, status: 'ACTIVE' } });
        setCatalog(pRes.data?.products || []);
      } catch (err) {
        if (activeBusiness) {
          let offlineProds = await db.products
            .where('businessId').equals(activeBusiness.id)
            .and(p => p.status === 'ACTIVE')
            .limit(50)
            .toArray();
          if (offlineProds.length === 0) {
            await seedDemoDataToDexie(activeBusiness.id);
            offlineProds = await db.products
              .where('businessId').equals(activeBusiness.id)
              .toArray();
          }
          setCatalog(offlineProds);
        }
      }
    };
    loadCatalog();
  }, [isOnline, activeBusiness]);

  // Persist cart, discount, heldBills, viewMode
  useEffect(() => {
    localStorage.setItem('pos_draft_cart', JSON.stringify(cart));
    localStorage.setItem('pos_draft_discount', discount.toString());
    localStorage.setItem('pos_draft_discount_mode', discountMode);
  }, [cart, discount, discountMode]);

  useEffect(() => {
    localStorage.setItem('pos_held_bills', JSON.stringify(heldBills));
  }, [heldBills]);

  // Keyboard shortcuts: Ctrl+K (search), Ctrl+H (hold bill), Ctrl+R (recall bills), F12 (checkout)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing = !!target && (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      );
      if (isEditing) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleHoldBill();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setIsRecallModalOpen(true);
      }
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0) handleCheckoutPreview();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, heldBills]);

  // Focus input automatically on mount and after scanner closes
  useEffect(() => {
    if (!isScannerOpen && !isRecallModalOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isScannerOpen, isRecallModalOpen]);

  // Calculations
  const calculateTotals = () => {
    let subtotal = 0;
    cart.forEach(item => {
      const gross = Number(item.sellingPrice) * Number(item.quantity);
      const net = Math.max(0, gross - Number(item.lineDiscount));
      subtotal += net;
    });

    const requestedDiscount = discountMode === 'PERCENT' ? subtotal * Math.min(100, Math.max(0, Number(discount) || 0)) / 100 : Number(discount) || 0;
    const orderDiscount = Math.min(requestedDiscount, subtotal);
    const total = Math.max(0, subtotal - orderDiscount);
    const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity), 0);

    return { subtotal, orderDiscount, total, totalItems };
  };

  const totals = calculateTotals();

  // Search logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim().length >= 2) {
        performSearch(searchInput.trim());
      } else {
        setSearchResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const performSearch = async (term: string) => {
    setIsSearching(true);
    try {
      // 1. Check local catalog exact barcode or sku match first
      const exactMatch = catalog.find(
        p => (p.barcode && p.barcode.trim() === term.trim()) || 
             (p.sku && p.sku.trim().toLowerCase() === term.trim().toLowerCase())
      );
      if (exactMatch) {
        setSearchResults([exactMatch]);
        setIsSearching(false);
        return;
      }

      // 2. Query products
      const res = await apiClient.get('/products', {
        params: { search: term, limit: 8, status: 'ACTIVE' }
      });
      setSearchResults(res.data?.products || []);
    } catch {
      // Fallback local search
      const q = term.toLowerCase();
      const local = catalog.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.barcode && p.barcode.includes(q)) || 
        (p.sku && p.sku.toLowerCase().includes(q))
      );
      setSearchResults(local.slice(0, 8));
    } finally {
      setIsSearching(false);
    }
  };

  // Enter submits an exact barcode/SKU lookup; never select a stale search result.
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchInput.trim();
    if (!term || isSearching) return;

    const localExact = catalog.find(
      p => (p.barcode && p.barcode.trim() === term) ||
           (p.sku && p.sku.trim().toLowerCase() === term.toLowerCase()) ||
           p.name.trim().toLowerCase() === term.toLowerCase()
    );

    if (localExact) {
      openQuantityDialog(localExact);
      return;
    }
    if (searchResults.length > 0) {
      openQuantityDialog(searchResults[0]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await apiClient.get(`/products/barcode/${encodeURIComponent(term)}`);
      const product = res.data?.data || res.data;
      if (product?.id) {
        openQuantityDialog(product);
        return;
      }
    } catch {
      // Continue with a normal product search below.
    }

    try {
      const res = await apiClient.get('/products', {
        params: { search: term, limit: 8, status: 'ACTIVE' }
      });
      const products: Product[] = res.data?.products || res.data?.data?.products || [];
      const exact = products.find(
        p => (p.barcode && p.barcode.trim() === term) ||
             (p.sku && p.sku.trim().toLowerCase() === term.toLowerCase()) ||
             p.name.trim().toLowerCase() === term.toLowerCase()
      );
      if (exact) {
        openQuantityDialog(exact);
      } else if (products.length === 1) {
        openQuantityDialog(products[0]);
      } else if (products.length > 1) {
        setSearchResults(products);
        toast('Select a product, enter quantity, then confirm.');
      } else {
        toast.error(`No product found for "${term}"`);
      }
    } catch {
      toast.error(`No product found for "${term}"`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleScan = async (code: string) => {
    setIsScannerOpen(false);
    try {
      const barcodeRes = await apiClient.get(`/products/barcode/${encodeURIComponent(code.trim())}`);
      const product = barcodeRes.data?.data || barcodeRes.data;
      if (product) {
        openQuantityDialog(product);
        toast.success(`Scanned: ${product.name}`);
      } else {
        toast.error('Product not found in catalog');
      }
    } catch {
      // Fallback to local catalog
      const local = catalog.find(p => p.barcode === code.trim());
      if (local) {
        openQuantityDialog(local);
        toast.success(`Scanned: ${local.name}`);
      } else {
        toast.error('Barcode not found in catalog');
      }
    }
  };

  const openQuantityDialog = (product: Product) => {
    if (product.status !== 'ACTIVE') { toast.error(`${product.name} is INACTIVE and cannot be sold.`); return; }
    setSelectedProduct(product);
    setQuantityDraft('1');
    setSearchResults([]);
    setTimeout(() => quantityInputRef.current?.select(), 50);
  };

  const handleAddToCart = (product: Product, quantity = 1) => {
    if (product.status !== 'ACTIVE') {
      toast.error(`${product.name} is INACTIVE and cannot be sold.`);
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) { toast.error('Enter a valid quantity.'); return; }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const newQty = existing ? existing.quantity + quantity : quantity;
      
      if (newQty > Number(product.stockQuantity)) {
        toast.error(`Stock limit reached for ${product.name}. Available: ${product.stockQuantity}`);
        return prev;
      }

      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { 
                ...item, 
                quantity: newQty, 
                lineSubtotal: Math.max(0, (newQty * item.sellingPrice) - (newQty * item.sellingPrice * (Number((item as any).lineDiscountPercent) || 0) / 100)),
                lineDiscount: newQty * item.sellingPrice * (Number((item as any).lineDiscountPercent) || 0) / 100
              }
            : item
        );
      }

      return [...prev, {
        ...product,
        cartItemId: Math.random().toString(36).substr(2, 9),
        quantity,
        lineDiscount: 0,
        lineDiscountPercent: 0,
        lineSubtotal: Number(product.sellingPrice) * quantity
      }];
    });

    setSearchInput('');
    setSearchResults([]);
    setSelectedProduct(null);
    setQuantityDraft('1');
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const confirmProductQuantity = () => {
    if (!selectedProduct) return;
    const quantity = Number(quantityDraft);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number(selectedProduct.stockQuantity)) { 
      toast.error('Enter a valid quantity within available stock.'); 
      return; 
    }
    handleAddToCart(selectedProduct, quantity);
  };

  const updateLineDiscountPercent = (cartItemId: string, raw: string) => {
    const percent = Math.min(100, Math.max(0, Number(raw) || 0));
    setCart(prev => prev.map(item => {
      if (item.cartItemId !== cartItemId) return item;
      const gross = Number(item.sellingPrice) * Number(item.quantity);
      const lineDiscount = gross * percent / 100;
      return { ...item, lineDiscount, lineDiscountPercent: percent, lineSubtotal: gross - lineDiscount };
    }));
  };

  const updateQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    
    setCart(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        if (newQty > Number(item.stockQuantity)) {
          toast.error(`Stock limit reached. Available: ${item.stockQuantity}`);
          return item;
        }
        return { 
          ...item, 
          quantity: newQty, 
          lineDiscount: newQty * item.sellingPrice * (Number(item.lineDiscountPercent) || 0) / 100,
          lineSubtotal: Math.max(0, (newQty * item.sellingPrice) - (newQty * item.sellingPrice * (Number(item.lineDiscountPercent) || 0) / 100)) 
        };
      }
      return item;
    }));
  };

  const updateQuantityDirect = (cartItemId: string, qtyStr: string) => {
    const newQty = parseFloat(qtyStr);
    if (isNaN(newQty) || newQty < 0) return;
    if (newQty === 0) {
      removeFromCart(cartItemId);
      return;
    }
    updateQuantity(cartItemId, newQty);
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setDiscountMode('AMOUNT');
    setCashTendered('');
    setIsClearConfirmOpen(false);
  };

  // --- HOLD BILLS (FOOD CITY STYLE) ---
  const handleHoldBill = () => {
    if (cart.length === 0) {
      toast.error('Cannot hold an empty bill. Add items first.');
      return;
    }

    const newHold: HeldBill = {
      id: `hold-${Date.now()}`,
      billNumber: `HOLD-#${(heldBills.length + 1).toString().padStart(2, '0')}`,
      heldAt: new Date().toISOString(),
      cashierName: user?.name || 'Cashier',
      items: [...cart],
      subtotal: totals.subtotal,
      discount,
      discountMode,
      total: totals.total,
      totalItems: totals.totalItems
    };

    setHeldBills(prev => [newHold, ...prev]);
    setCart([]);
    setDiscount(0);
    setCashTendered('');
    localStorage.removeItem('pos_draft_cart');
    localStorage.removeItem('pos_draft_discount');
    localStorage.removeItem('pos_draft_discount_mode');
    toast.success(`Bill ${newHold.billNumber} held! Counter ready for next customer.`);
  };

  const handleRecallBill = (bill: HeldBill) => {
    // If active cart already has items, auto-hold current bill so nothing is lost
    if (cart.length > 0) {
      const autoHold: HeldBill = {
        id: `hold-${Date.now()}`,
        billNumber: `HOLD-#${(heldBills.length + 1).toString().padStart(2, '0')}`,
        heldAt: new Date().toISOString(),
        cashierName: user?.name || 'Cashier',
        items: [...cart],
        subtotal: totals.subtotal,
        discount,
        total: totals.total,
        totalItems: totals.totalItems
      };
      setHeldBills(prev => [autoHold, ...prev.filter(b => b.id !== bill.id)]);
      toast.success(`Active cart saved as ${autoHold.billNumber}`);
    } else {
      setHeldBills(prev => prev.filter(b => b.id !== bill.id));
    }

    setCart(bill.items);
    setDiscount(bill.discount);
    setDiscountMode(bill.discountMode || 'AMOUNT');
    setIsRecallModalOpen(false);
    toast.success(`Recalled ${bill.billNumber} (${bill.items.length} items)`);
  };

  const handleDeleteHeldBill = (id: string) => {
    setHeldBills(prev => prev.filter(b => b.id !== id));
    toast.success('Held bill discarded');
  };

  // Checkout handlers
  const handleCheckoutPreview = () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);
  };

  const handleCheckoutSuccess = (orderData: any) => {
    setCart([]);
    setDiscount(0);
    setCashTendered('');
    localStorage.removeItem('pos_draft_cart');
    localStorage.removeItem('pos_draft_discount');
    setIsCheckingOut(false);
    setCompletedOrderId(orderData.id);
  };

  // Calculated change due for cash tender helper
  const parsedTendered = parseFloat(cashTendered) || 0;
  const changeDue = parsedTendered > 0 ? parsedTendered - totals.total : 0;

  return (
    <>
      {/* Product Quantity Modal */}
      {selectedProduct && (
        <Modal isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} title="Add product to bill" maxWidth="sm">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="font-bold text-slate-900 text-base">{selectedProduct.name}</div>
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span className="font-mono">{selectedProduct.barcode || selectedProduct.sku || 'No barcode'}</span>
                <span>In Stock: <strong className="text-slate-800">{selectedProduct.stockQuantity}</strong></span>
              </div>
              <div className="mt-2 text-xl font-black text-blue-700">
                {formatLKR(selectedProduct.sellingPrice)} <span className="text-xs font-medium text-slate-500">/ {selectedProduct.unit || 'unit'}</span>
              </div>
            </div>
            <div>
              <label htmlFor="product-quantity" className="mb-1 block text-sm font-semibold text-slate-700">Quantity</label>
              <input 
                ref={quantityInputRef} 
                id="product-quantity" 
                type="number" 
                min="0.001" 
                step="any" 
                inputMode="decimal" 
                autoFocus 
                value={quantityDraft} 
                onChange={e => setQuantityDraft(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmProductQuantity(); } }} 
                className="h-12 w-full rounded-xl border-2 border-blue-600 px-3 text-xl font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all text-center"
              />
            </div>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setSelectedProduct(null)} 
                className="h-11 flex-1 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={confirmProductQuantity} 
                className="h-11 flex-1 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 active:scale-95 shadow-sm transition-all"
              >
                Add to bill
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Completed Receipt Modal */}
      {completedOrderId && (
        <ReceiptPreviewModal
          isOpen={!!completedOrderId}
          onClose={() => setCompletedOrderId(null)}
          orderId={completedOrderId}
        />
      )}

      {/* Checkout Payment Modal */}
      {isCheckingOut && (
        <CheckoutModal 
          isOpen={isCheckingOut}
          onClose={() => setIsCheckingOut(false)}
          cartItems={cart}
          orderDiscount={totals.orderDiscount}
          initialAmountTendered={cashTendered}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Confirm Void Dialog */}
      <ConfirmDialog 
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={clearCart}
        title="Void / Clear Bill"
        description="Are you sure you want to remove all items from this active bill?"
        confirmText="Void Bill"
        isDanger
      />

      {/* Barcode Camera Scanner */}
      {isScannerOpen && (
        <BarcodeScanner 
          onScan={handleScan} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}

      {/* Held Bills (Recall) Modal */}
      {isRecallModalOpen && (
        <Modal
          isOpen={isRecallModalOpen}
          onClose={() => setIsRecallModalOpen(false)}
          title={`Parked / Held Bills (${heldBills.length})`}
          maxWidth="xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/80">
              <span className="flex items-center gap-2 font-medium text-slate-600">
                <Clock size={15} className="text-amber-600 shrink-0" />
                <span>Held transactions are stored locally. Resume any customer's bill or discard it anytime.</span>
              </span>
            </div>

            {heldBills.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <PauseCircle size={28} />
                </div>
                <p className="font-bold text-slate-700 text-sm">No held bills in queue</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  When a customer steps away to get more items, press <strong className="text-amber-700 font-semibold">Hold Bill (Ctrl+H)</strong> to free the billing counter.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {heldBills.map((bill) => (
                  <div 
                    key={bill.id}
                    className="p-4 bg-white border border-slate-200 hover:border-blue-400 rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col gap-3 group"
                  >
                    <div className="flex items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs px-2.5 py-1 rounded-lg tracking-wide uppercase shadow-2xs whitespace-nowrap">
                          {bill.billNumber}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium bg-slate-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                          <Clock size={12} className="text-slate-400" />
                          <span>{new Date(bill.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                          {bill.totalItems} {bill.totalItems === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Due</span>
                        <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight whitespace-nowrap">
                          {formatLKR(bill.total)}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-100 text-xs">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {bill.items.map((it, idx) => (
                          <span 
                            key={idx} 
                            className="bg-white border border-slate-200/90 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-800 flex items-center gap-1.5 shadow-2xs"
                          >
                            <span className="text-slate-900 font-semibold">{it.name}</span>
                            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded text-[10px] font-black">×{it.quantity}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                        Click Resume to restore to active billing counter
                      </span>
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          onClick={() => handleDeleteHeldBill(bill.id)}
                          className="px-3 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                          title="Discard held bill"
                        >
                          <Trash2 size={14} />
                          <span>Discard</span>
                        </button>

                        <button 
                          type="button"
                          onClick={() => handleRecallBill(bill)}
                          className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                        >
                          <PlayCircle size={15} />
                          <span>Resume Bill</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">
                {heldBills.length} {heldBills.length === 1 ? 'bill' : 'bills'} held
              </span>
              <Button variant="secondary" onClick={() => setIsRecallModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Flagship Supermarket / Retail POS Layout */}
      <div className="h-[calc(100vh-64px)] min-h-0 w-full overflow-hidden bg-slate-100/70 p-3 sm:p-4 flex flex-col xl:flex-row gap-4 font-sans text-slate-800 antialiased">
        
        {/* Left Side: Scan Bar + Invoice Ledger Table */}
        <section className="flex-1 min-w-0 min-h-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden">
          
          {/* Top Cashier Bar: Prominent Barcode Search & Fast Action Pills */}
          <div className="p-3 sm:p-4 border-b border-slate-200/80 bg-white flex flex-col md:flex-row md:items-center gap-3 justify-between shrink-0">
            {/* Primary Search / Barcode Input */}
            <div className="flex-1 min-w-0 relative">
              <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search size={19} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    autoComplete="off"
                    placeholder="Scan barcode (e.g. 4792019000012) or search product name..."
                    className="h-12 w-full pl-11 pr-28 rounded-xl border border-slate-300 bg-slate-50/70 hover:bg-white focus:bg-white text-sm sm:text-base font-medium transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-100/50 outline-none placeholder:text-slate-400 shadow-2xs"
                  />
                  {/* Embedded Camera Scanner Action Button */}
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setIsScannerOpen(true)}
                      title="Open Camera Barcode Scanner"
                      className="h-9 px-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs flex items-center gap-1.5 transition-colors border border-blue-200/60 shadow-2xs"
                    >
                      <ScanLine size={16} />
                      <span className="hidden sm:inline">Camera</span>
                    </button>
                  </div>

                  {/* Autocomplete Search Dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute z-40 top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                      {searchResults.map(prod => (
                        <button
                          type="button"
                          key={prod.id}
                          onClick={() => openQuantityDialog(prod)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center justify-between gap-3 transition-colors group"
                        >
                          <div className="min-w-0">
                            <span className="block text-sm font-bold text-slate-900 group-hover:text-blue-700 truncate">{prod.name}</span>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                              <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[11px] text-slate-600">{prod.barcode || prod.sku || 'No Barcode'}</span>
                              <span>• In Stock: <strong className="text-slate-700">{prod.stockQuantity}</strong></span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-sm text-slate-900">{formatLKR(prod.sellingPrice)}</span>
                            <span className="block text-[10px] text-slate-400 font-medium">/{prod.unit || 'unit'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Quick Action Buttons Group */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleHoldBill}
                disabled={!cart.length}
                className="h-11 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-800 font-semibold text-xs transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-40 disabled:pointer-events-none"
                title="Suspend active bill (Ctrl+H)"
              >
                <PauseCircle size={16} className="text-amber-600" />
                <span>Hold Bill</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRecallModalOpen(true)}
                className="h-11 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-800 font-semibold text-xs transition-all flex items-center gap-1.5 shadow-2xs relative"
                title="View and resume held bills (Ctrl+R)"
              >
                <PlayCircle size={16} className="text-blue-600" />
                <span>Held Bills</span>
                {heldBills.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-black">
                    {heldBills.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(true)}
                disabled={!cart.length}
                className="h-11 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-slate-600 hover:text-rose-700 font-semibold text-xs transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-40 disabled:pointer-events-none"
                title="Void current sale"
              >
                <Trash2 size={16} className="text-rose-500" />
                <span className="hidden sm:inline">Void</span>
              </button>
            </div>
          </div>

          {/* Supermarket Invoice Ledger Table */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <table className="w-full min-w-[760px] text-sm border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3 w-36">Barcode</th>
                  <th className="px-4 py-3">Product Description</th>
                  <th className="px-4 py-3 text-right w-28">Unit Price</th>
                  <th className="px-4 py-3 text-center w-36">Quantity</th>
                  <th className="px-4 py-3 text-right w-28">Discount</th>
                  <th className="px-4 py-3 text-right w-36">Line Total</th>
                  <th className="px-3 py-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-24 text-center">
                      <div className="mx-auto mb-3.5 h-16 w-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                        <ShoppingCart size={30} />
                      </div>
                      <h3 className="text-base font-bold text-slate-800">Billing Counter Ready</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Scan items with a barcode scanner, camera, or search by product name above to build customer invoice.
                      </p>
                    </td>
                  </tr>
                ) : (
                  cart.map((item, index) => (
                    <tr key={item.cartItemId} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-3 text-center font-medium text-slate-400 text-xs">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {item.barcode || item.sku || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 group-hover:text-blue-900 transition-colors">
                          {item.name}
                        </div>
                        {item.company && (
                          <div className="text-[11px] text-slate-400 font-medium">{item.company}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700 tabular-nums">
                        {formatLKR(item.sellingPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors shadow-2xs"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updateQuantityDirect(item.cartItemId, e.target.value)}
                            className="w-14 h-8 text-center border border-slate-200 rounded-lg font-bold text-xs bg-white text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors shadow-2xs"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <input
                            aria-label={`Discount percentage for ${item.name}`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={Number((item as any).lineDiscountPercent) || ''}
                            onChange={e => updateLineDiscountPercent(item.cartItemId, e.target.value)}
                            placeholder="0"
                            className="w-14 h-7 text-right border border-slate-200 rounded-md px-1.5 text-xs outline-none focus:border-blue-500"
                          />
                          <span className="text-[11px] text-slate-400 font-bold">%</span>
                        </div>
                        {item.lineDiscount > 0 && (
                          <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                            -{formatLKR(item.lineDiscount)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-900 tabular-nums">
                        {formatLKR(Math.max(0, Number(item.sellingPrice) * Number(item.quantity) - Number(item.lineDiscount)))}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.cartItemId)}
                          title="Remove item"
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Add Bar & Keyboard Shortcut Legend */}
          <div className="border-t border-slate-200 bg-slate-50/70 p-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 shrink-0">Fast Add:</span>
              {catalog.slice(0, 6).map(prod => (
                <button
                  type="button"
                  key={prod.id}
                  onClick={() => handleAddToCart(prod)}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50 text-xs font-semibold text-slate-700 transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <span>{prod.name.split(' ').slice(0, 2).join(' ')}</span>
                  <span className="text-slate-400 font-normal">{formatLKR(prod.sellingPrice)}</span>
                </button>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-400 font-medium shrink-0">
              <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 px-1 rounded text-[10px] font-bold text-slate-600">Ctrl+K</kbd> Search</span>
              <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 px-1 rounded text-[10px] font-bold text-slate-600">Ctrl+H</kbd> Hold</span>
              <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 px-1 rounded text-[10px] font-bold text-slate-600">Ctrl+R</kbd> Recall</span>
              <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 px-1 rounded text-[10px] font-bold text-slate-600">F12</kbd> Pay</span>
            </div>
          </div>
        </section>

        {/* Right Side: Modern Supermarket Checkout Counter */}
        <aside className="w-full xl:w-[380px] 2xl:w-[420px] shrink-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden min-h-[500px]">
          
          {/* Checkout Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Bill Summary</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Counter 01 • Cashier: {user?.name || 'Cashier'}</p>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2.5 py-1 rounded-full">
              {cart.length} lines ({totals.totalItems} items)
            </span>
          </div>

          <div className="p-4 sm:p-5 flex-1 flex flex-col gap-4 overflow-y-auto">
            {/* Customer Walk-in Selector */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <User size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Walk-in Customer</div>
                  <div className="text-[10px] text-slate-400">Regular retail pricing</div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white border border-slate-200 px-2 py-0.5 rounded">Default</span>
            </div>

            {/* Subtotal & Discount Rows */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Gross Subtotal</span>
                <span className="font-bold tabular-nums text-slate-900">{formatLKR(totals.subtotal)}</span>
              </div>

              {/* Order Discount Control */}
              <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-100">
                <label htmlFor="order-discount" className="text-xs font-semibold text-slate-600">
                  Bill Discount
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-slate-100 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setDiscountMode('AMOUNT')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${discountMode === 'AMOUNT' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                    >
                      LKR
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountMode('PERCENT')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${discountMode === 'PERCENT' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                    >
                      %
                    </button>
                  </div>
                  <input
                    id="order-discount"
                    type="number"
                    min="0"
                    max={discountMode === 'PERCENT' ? 100 : totals.subtotal}
                    value={discount || ''}
                    onChange={e => setDiscount(Math.min(discountMode === 'PERCENT' ? 100 : totals.subtotal, Math.max(0, parseFloat(e.target.value) || 0)))}
                    placeholder="0"
                    className="w-20 text-right border border-slate-200 rounded-lg px-2.5 py-1 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {totals.orderDiscount > 0 && (
                <div className="flex justify-between text-rose-600 text-xs font-bold">
                  <span>Discount Applied</span>
                  <span>-{formatLKR(totals.orderDiscount)}</span>
                </div>
              )}
            </div>

            {/* Flagship High-Contrast LCD Total Card */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white p-5 shadow-inner">
              <div className="flex justify-between items-center text-[11px] uppercase tracking-widest text-blue-200/90 font-bold">
                <span>Total Amount Due</span>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-md text-[10px]">
                  Sri Lanka (LKR)
                </span>
              </div>
              <div className="mt-3 text-3xl 2xl:text-4xl font-black tracking-tight tabular-nums text-white">
                {formatLKR(totals.total)}
              </div>
            </div>

            {/* Quick Cash Tender Calculator */}
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="cash-tendered" className="text-xs font-bold text-slate-700">Cash Received</label>
                <input
                  id="cash-tendered"
                  type="number"
                  min="0"
                  value={cashTendered}
                  onChange={e => setCashTendered(e.target.value)}
                  placeholder={totals.total > 0 ? totals.total.toFixed(2) : "0.00"}
                  className="w-36 border border-slate-300 rounded-lg px-3 py-1.5 text-right text-base font-black text-slate-900 outline-none focus:border-blue-600 bg-white shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {['Exact', '500', '1000', '5000'].map((amount, i) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setCashTendered(i === 0 ? totals.total.toString() : amount)}
                    className="py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-xs font-bold text-slate-700 transition-colors shadow-2xs"
                  >
                    {i === 0 ? 'Exact' : Number(amount).toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Dynamic Change Indicator */}
              <div className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between border transition-all ${
                parsedTendered >= totals.total && parsedTendered > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : parsedTendered > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}>
                <span className="text-xs font-bold">
                  {parsedTendered >= totals.total ? 'Change Due' : parsedTendered > 0 ? 'Amount Short' : 'Change'}
                </span>
                <strong className="text-base tabular-nums font-black">
                  {formatLKR(Math.abs(changeDue))}
                </strong>
              </div>
            </div>

            {/* Complete Sale Primary Action */}
            <div className="mt-auto pt-2 space-y-2">
              <Button
                className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-base font-black shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                disabled={!cart.length || isCheckingOut}
                isLoading={isCheckingOut}
                onClick={handleCheckoutPreview}
              >
                <CreditCard size={20} />
                <span>Complete Sale (F12)</span>
              </Button>
              <p className="text-[11px] text-center text-slate-400 font-medium">
                Supports Cash, Card, Bank Transfer, QR & Thermal Receipt
              </p>
            </div>

          </div>
        </aside>

      </div>
    </>
  );
};
