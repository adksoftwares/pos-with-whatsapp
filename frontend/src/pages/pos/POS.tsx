import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { 
  ScanLine, Search, Plus, Minus, Trash2, ShoppingCart, 
  PauseCircle, PlayCircle, Clock, 
  CreditCard
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
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRecallModalOpen, setIsRecallModalOpen] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  
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
  }, [cart, discount]);

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

    const orderDiscount = Math.min(Number(discount) || 0, subtotal);
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
    }, 250);
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
        handleAddToCart(exactMatch);
        setSearchInput('');
        setSearchResults([]);
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
      handleAddToCart(localExact);
      return;
    }

    setIsSearching(true);
    try {
      const res = await apiClient.get(`/products/barcode/${encodeURIComponent(term)}`);
      const product = res.data?.data || res.data;
      if (product?.id) {
        handleAddToCart(product);
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
        handleAddToCart(exact);
      } else if (products.length === 1) {
        handleAddToCart(products[0]);
      } else if (products.length > 1) {
        setSearchResults(products);
        toast('Select the correct product from the search results.');
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
        handleAddToCart(product);
        toast.success(`Scanned: ${product.name}`);
      } else {
        toast.error('Product not found in catalog');
      }
    } catch {
      // Fallback to local catalog
      const local = catalog.find(p => p.barcode === code.trim());
      if (local) {
        handleAddToCart(local);
        toast.success(`Scanned: ${local.name}`);
      } else {
        toast.error('Barcode not found in catalog');
      }
    }
  };

  const handleAddToCart = (product: Product) => {
    if (product.status !== 'ACTIVE') {
      toast.error(`${product.name} is INACTIVE and cannot be sold.`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const newQty = existing ? existing.quantity + 1 : 1;
      
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
                lineSubtotal: Math.max(0, (newQty * item.sellingPrice) - item.lineDiscount)
              }
            : item
        );
      }

      return [...prev, {
        ...product,
        cartItemId: Math.random().toString(36).substr(2, 9),
        quantity: 1,
        lineDiscount: 0,
        lineSubtotal: Number(product.sellingPrice)
      }];
    });

    setSearchInput('');
    setSearchResults([]);
    if (searchInputRef.current) searchInputRef.current.focus();
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
          lineSubtotal: Math.max(0, (newQty * item.sellingPrice) - item.lineDiscount) 
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
      total: totals.total,
      totalItems: totals.totalItems
    };

    setHeldBills(prev => [newHold, ...prev]);
    setCart([]);
    setDiscount(0);
    setCashTendered('');
    localStorage.removeItem('pos_draft_cart');
    localStorage.removeItem('pos_draft_discount');
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
      
      {/* Modals */}
      {completedOrderId && (
        <ReceiptPreviewModal
          isOpen={!!completedOrderId}
          onClose={() => setCompletedOrderId(null)}
          orderId={completedOrderId}
        />
      )}

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

      <ConfirmDialog 
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={clearCart}
        title="Void / Clear Bill"
        description="Are you sure you want to remove all items from this customer's active bill?"
        confirmText="Clear Bill"
        isDanger
      />

      {isScannerOpen && (
        <BarcodeScanner 
          onScan={handleScan} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}

      {/* Held Bills (Recall) Modal - Human-crafted UI/UX */}
      {isRecallModalOpen && (
        <Modal
          isOpen={isRecallModalOpen}
          onClose={() => setIsRecallModalOpen(false)}
          title={`Parked Transactions (${heldBills.length})`}
          maxWidth="xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/80">
              <span className="flex items-center gap-2 font-medium text-slate-600">
                <Clock size={15} className="text-amber-600 shrink-0" />
                <span>Parked bills are saved locally. You can resume any customer's bill or discard it anytime.</span>
              </span>
            </div>

            {heldBills.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <PauseCircle size={28} />
                </div>
                <p className="font-bold text-slate-700 text-sm">No parked bills in queue</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  When a customer steps away to grab more items, click <strong className="text-amber-700 font-semibold">Hold Bill</strong> to free up the counter.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {heldBills.map((bill) => (
                  <div 
                    key={bill.id}
                    className="p-4 bg-white border border-slate-200 hover:border-blue-400 rounded-2xl shadow-xs hover:shadow-sm transition-all flex flex-col gap-3 group"
                  >
                    {/* Top Row: Bill Reference, Timestamp, Item Count, and Grand Total */}
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

                      {/* Total Amount Due */}
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Due</span>
                        <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight whitespace-nowrap">
                          {formatLKR(bill.total)}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Clean Item Breakdown Chips */}
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

                    {/* Bottom Action Footer */}
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
                {heldBills.length} {heldBills.length === 1 ? 'transaction' : 'transactions'} suspended
              </span>
              <Button variant="secondary" onClick={() => setIsRecallModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Retail billing workspace */}
      <div className="h-[calc(100vh-64px)] min-h-0 w-full overflow-hidden bg-[#edf1f6] flex flex-col text-slate-800">
        {/* Counter toolbar */}
        <div className="shrink-0 bg-[#082b59] text-white px-4 py-3 flex flex-wrap items-center gap-3 shadow-md">
          <div className="flex items-center gap-3 min-w-[190px]">
            <div className="h-10 w-10 rounded-lg bg-blue-500 flex items-center justify-center text-xl font-black shadow-inner">▣</div>
            <div>
              <div className="font-bold leading-tight tracking-wide">RETAIL BILLING</div>
              <div className="text-[10px] text-blue-200 tracking-[0.18em] uppercase">Sales counter</div>
            </div>
          </div>
          <div className="hidden md:flex flex-1 items-center justify-center gap-2">
            <span className="px-4 py-2 rounded-md bg-blue-600 text-white text-xs font-bold shadow-inner">Sales</span>
            <span className="px-4 py-2 rounded-md text-blue-100/80 text-xs font-semibold">Billing</span>
            <span className="px-4 py-2 rounded-md text-blue-100/80 text-xs font-semibold">Counter { '01' }</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className={`px-3 py-1.5 rounded-full font-bold ${isOnline ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>
              {isOnline ? '● ONLINE' : '● OFFLINE'}
            </span>
            <div className="text-right">
              <div className="font-bold">{user?.name || 'Cashier'}</div>
              <div className="text-[10px] text-blue-200">CASHIER</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-slate-100 text-[#082b59] flex items-center justify-center font-black">{user?.name?.charAt(0).toUpperCase() || 'C'}</div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col xl:flex-row gap-3 p-3 overflow-y-auto xl:overflow-hidden">
          {/* Left: invoice and product entry */}
          <section className="flex-1 min-w-0 min-h-[430px] flex flex-col gap-3">
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-3 grid grid-cols-2 lg:grid-cols-[150px_180px_180px_minmax(220px,1fr)] gap-3 items-end">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Invoice number</label>
                <div className="h-9 flex items-center px-3 bg-slate-50 border border-slate-200 rounded text-sm font-bold text-slate-800">Draft sale</div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Date</label>
                <div className="h-9 flex items-center px-3 bg-slate-50 border border-slate-200 rounded text-sm">{new Date().toLocaleDateString()}</div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Cashier</label>
                <div className="h-9 flex items-center px-3 bg-slate-50 border border-slate-200 rounded text-sm truncate">{user?.name || 'Cashier'}</div>
              </div>
              <div className="col-span-2 lg:col-span-1">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Scan barcode / search product</label>
                <form onSubmit={handleBarcodeSubmit} aria-busy={isSearching} className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input ref={searchInputRef} value={searchInput} onChange={e => setSearchInput(e.target.value)} autoComplete="off" placeholder="Scan barcode or type product name..." className="h-10 w-full pl-9 pr-3 border-2 border-blue-700 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-200" />
                    {searchResults.length > 0 && <div className="absolute z-40 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-xl max-h-64 overflow-y-auto">
                      {searchResults.map(prod => <button type="button" key={prod.id} onClick={() => handleAddToCart(prod)} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-slate-100 flex justify-between gap-3">
                        <span className="min-w-0"><span className="block text-sm font-semibold truncate">{prod.name}</span><span className="text-[10px] text-slate-400">{prod.barcode || prod.sku || 'No barcode'}</span></span>
                        <span className="font-bold text-sm whitespace-nowrap">{formatLKR(prod.sellingPrice)}</span>
                      </button>)}
                    </div>}
                  </div>
                  <button type="button" onClick={() => setIsScannerOpen(true)} title="Open camera scanner" className="h-10 w-11 shrink-0 border border-slate-300 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><ScanLine size={19}/></button>
                </form>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 min-h-[260px] flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold text-sm text-slate-800">Current sale items</h2>
                  <p className="text-[11px] text-slate-400">Scan each product or search by name / SKU</p>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-full text-xs font-bold">{totals.totalItems} Qty</span>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[850px] text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-[#123b70] text-white">
                    <tr className="text-[10px] uppercase tracking-wider text-left">
                      <th className="px-3 py-3 w-10">#</th>
                      <th className="px-3 py-3 w-32">Barcode</th>
                      <th className="px-3 py-3">Product name</th>
                      <th className="px-3 py-3 text-center w-28">Qty</th>
                      <th className="px-3 py-3 text-right w-28">Unit price</th>
                      <th className="px-3 py-3 text-right w-24">Discount</th>
                      <th className="px-3 py-3 text-right w-32">Amount</th>
                      <th className="px-3 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.length === 0 ? <tr><td colSpan={8} className="py-20 text-center">
                      <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center"><ShoppingCart size={25}/></div>
                      <div className="font-bold text-slate-600">Ready to scan</div>
                      <p className="text-xs text-slate-400 mt-1">Product details will appear here when scanned</p>
                    </td></tr> : cart.map((item,index) => <tr key={item.cartItemId} className="hover:bg-blue-50/50">
                      <td className="px-3 py-3 text-xs text-slate-400">{index+1}</td>
                      <td className="px-3 py-3"><span className="font-mono text-[11px] text-slate-600">{item.barcode || item.sku || '—'}</span></td>
                      <td className="px-3 py-3"><div className="font-semibold text-slate-800">{item.name}</div>{item.company && <div className="text-[10px] text-slate-400">{item.company}</div>}</td>
                      <td className="px-3 py-3"><div className="flex items-center justify-center gap-1">
                        <button type="button" onClick={() => updateQuantity(item.cartItemId,item.quantity-1)} className="h-7 w-7 border border-slate-200 rounded hover:bg-slate-100"><Minus size={12} className="mx-auto"/></button>
                        <input type="number" min="1" value={item.quantity} onChange={e => updateQuantityDirect(item.cartItemId,e.target.value)} className="w-12 h-7 text-center border border-slate-200 rounded font-bold text-xs"/>
                        <button type="button" onClick={() => updateQuantity(item.cartItemId,item.quantity+1)} className="h-7 w-7 border border-slate-200 rounded hover:bg-slate-100"><Plus size={12} className="mx-auto"/></button>
                      </div></td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatLKR(item.sellingPrice)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-500">{formatLKR(item.lineDiscount)}</td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums">{formatLKR(Math.max(0, Number(item.sellingPrice) * Number(item.quantity) - Number(item.lineDiscount)))}</td>
                      <td className="px-3 py-3"><button type="button" onClick={() => removeFromCart(item.cartItemId)} title="Remove item" className="text-rose-500 hover:bg-rose-50 rounded p-1"><Trash2 size={15}/></button></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 shrink-0">Quick add</span>
                {catalog.slice(0,6).map(prod => <button type="button" key={prod.id} onClick={() => handleAddToCart(prod)} className="shrink-0 px-3 py-1.5 rounded border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50 text-xs font-semibold">{prod.name.split(' ').slice(0,2).join(' ')} <span className="text-slate-400 font-normal">{formatLKR(prod.sellingPrice)}</span></button>)}
                
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => searchInputRef.current?.focus()} className="flex-1 bg-white border border-slate-200 rounded-md p-2 text-left hover:border-blue-400"><span className="text-[10px] text-slate-400 font-bold">CTRL + K</span><span className="block text-xs font-bold">Search product</span></button>
              <button type="button" onClick={handleHoldBill} disabled={!cart.length} className="flex-1 bg-white border border-slate-200 rounded-md p-2 text-left hover:border-amber-400 disabled:opacity-40"><span className="text-[10px] text-slate-400 font-bold">CTRL + H</span><span className="block text-xs font-bold">Hold bill</span></button>
              <button type="button" onClick={() => setIsRecallModalOpen(true)} className="flex-1 bg-white border border-slate-200 rounded-md p-2 text-left hover:border-blue-400"><span className="text-[10px] text-slate-400 font-bold">CTRL + R</span><span className="block text-xs font-bold">Held bills ({heldBills.length})</span></button>
              <button type="button" onClick={() => setIsClearConfirmOpen(true)} disabled={!cart.length} className="flex-1 bg-white border border-slate-200 rounded-md p-2 text-left hover:border-rose-400 disabled:opacity-40"><span className="text-[10px] text-slate-400 font-bold">VOID</span><span className="block text-xs font-bold text-rose-600">Clear sale</span></button>
            </div>
          </section>

          {/* Right: payment summary */}
          <aside className="w-full xl:w-[370px] 2xl:w-[410px] shrink-0 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden min-h-[430px]">
            <div className="bg-[#f7f9fc] border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div><h2 className="font-bold text-sm">Bill summary</h2><p className="text-[11px] text-slate-400">Counter 01 · {user?.name || 'Cashier'}</p></div>
              <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded">{cart.length} lines</span>
            </div>
            <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Total items</span><strong>{cart.length}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Total quantity</span><strong>{totals.totalItems}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Sub total</span><strong>{formatLKR(totals.subtotal)}</strong></div>
                <div className="flex justify-between items-center gap-3"><label htmlFor="order-discount" className="text-slate-500">Discount</label><div className="flex items-center gap-1"><span className="text-xs text-slate-400">LKR</span><input id="order-discount" type="number" min="0" value={discount || ''} onChange={e => setDiscount(Math.min(totals.subtotal,Math.max(0,parseFloat(e.target.value)||0)))} placeholder="0.00" className="w-28 text-right border border-slate-200 rounded px-2 py-1.5 text-sm font-semibold"/></div></div>
                <div className="flex justify-between text-slate-500"><span>Tax / VAT</span><span className="text-[11px] font-medium">Confirmed at checkout</span></div>
              </div>
              <div className="rounded-lg bg-[#123b70] text-white p-4 shadow-inner">
                <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.15em] text-blue-200 font-bold"><span>Estimated total · before final tax</span><span>LKR</span></div>
                <div className="mt-2 text-3xl 2xl:text-4xl font-black tracking-tight tabular-nums break-words">{formatLKR(totals.total)}</div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between"><label htmlFor="cash-tendered" className="text-xs font-bold text-slate-600">Paid amount</label><input id="cash-tendered" type="number" min="0" value={cashTendered} onChange={e => setCashTendered(e.target.value)} placeholder={totals.total.toFixed(2)} className="w-32 border border-slate-200 rounded px-2.5 py-2 text-right text-sm font-bold"/></div>
                <div className="grid grid-cols-4 gap-1.5">
                  {['Exact','500','1000','5000'].map((amount,i) => <button key={amount} type="button" onClick={() => setCashTendered(i===0 ? totals.total.toString() : amount)} className="py-2 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 text-[11px] font-bold">{i===0 ? 'Exact' : Number(amount).toLocaleString()}</button>)}
                </div>
                <div className={`rounded-md px-3 py-3 flex items-center justify-between ${parsedTendered >= totals.total && parsedTendered > 0 ? 'bg-emerald-50 text-emerald-800' : parsedTendered > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>
                  <span className="text-xs font-bold">{parsedTendered >= totals.total ? 'Estimated change' : parsedTendered > 0 ? 'Amount short' : 'Change due'}</span>
                  <strong className="text-lg tabular-nums">{formatLKR(Math.abs(changeDue))}</strong>
                </div>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-2">
                <button type="button" onClick={handleHoldBill} disabled={!cart.length} className="h-11 rounded-md border border-amber-300 bg-amber-50 text-amber-800 font-bold text-xs disabled:opacity-40 flex items-center justify-center gap-2"><PauseCircle size={16}/> Hold bill</button>
                <button type="button" onClick={() => setIsRecallModalOpen(true)} className="h-11 rounded-md border border-slate-200 bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2"><PlayCircle size={16}/> Held bills</button>
              </div>
              <Button className="w-full h-12 rounded-md bg-[#159447] hover:bg-[#117c3b] text-white text-sm font-black shadow-sm" disabled={!cart.length || isCheckingOut} isLoading={isCheckingOut} onClick={handleCheckoutPreview}>
                <CreditCard size={18}/> <span>Complete sale · F12</span>
              </Button>
              <p className="text-[10px] text-center text-slate-400">Payment is confirmed in the checkout window.</p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
};
