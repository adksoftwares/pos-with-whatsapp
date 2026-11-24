import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { 
  ScanLine, Search, Plus, Minus, Trash2, X, ShoppingCart, 
  PauseCircle, PlayCircle, Clock, Store, Grid, 
  CreditCard, Sparkles
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
import { DEMO_CATEGORIES, seedDemoDataToDexie } from '../../utils/offlineDemoSeed';

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
    const saved = localStorage.getItem('pos_draft_cart');
    return saved ? JSON.parse(saved) : [];
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

  // POS Mode: 'SUPERMARKET' (Food City Table Grid) or 'CATALOG' (Touch Tiles)
  const [posMode, setPosMode] = useState<'SUPERMARKET' | 'CATALOG'>(() => {
    return (localStorage.getItem('pos_view_mode') as any) || 'SUPERMARKET';
  });

  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isRecallModalOpen, setIsRecallModalOpen] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  
  const [discount, setDiscount] = useState<number>(() => {
    const saved = localStorage.getItem('pos_draft_discount');
    return saved ? parseFloat(saved) : 0;
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
        const [pRes, cRes] = await Promise.all([
          apiClient.get('/products', { params: { limit: 50, status: 'ACTIVE' } }),
          apiClient.get('/categories')
        ]);
        setCatalog(pRes.data?.products || []);
        setCategories(cRes.data || []);
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
          setCategories(DEMO_CATEGORIES);
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

  useEffect(() => {
    localStorage.setItem('pos_view_mode', posMode);
  }, [posMode]);

  // Keyboard shortcuts: Ctrl+K (search), Ctrl+H (hold bill), Ctrl+R (recall bills), F12 (checkout)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  // Immediate Enter key submit on barcode scanner input
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchInput.trim();
    if (!term) return;

    // Check exact barcode or SKU in catalog
    const matched = catalog.find(
      p => (p.barcode && p.barcode.trim() === term) ||
           (p.sku && p.sku.toLowerCase() === term.toLowerCase()) ||
           p.name.toLowerCase() === term.toLowerCase()
    );

    if (matched) {
      handleAddToCart(matched);
      setSearchInput('');
      setSearchResults([]);
      return;
    }

    // If search results exist, pick first result
    if (searchResults.length > 0) {
      handleAddToCart(searchResults[0]);
      setSearchInput('');
      setSearchResults([]);
      return;
    }

    // Try API barcode search
    apiClient.get(`/products/barcode/${encodeURIComponent(term)}`)
      .then(res => {
        const prod = res.data?.data || res.data;
        if (prod) {
          handleAddToCart(prod);
          setSearchInput('');
          setSearchResults([]);
        } else {
          toast.error(`No product found for code "${term}"`);
        }
      })
      .catch(() => {
        toast.error(`No product found for code "${term}"`);
      });
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
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row bg-slate-100 overflow-hidden w-full select-none font-sans">
      
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

      {/* Main Billing Workspace */}
      <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden relative">
        
        {/* Top Cashier Bar: Barcode search, Hold/Recall, Layout Toggle */}
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 shadow-xs shrink-0 z-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Fast Barcode & Item Search Form */}
            <form onSubmit={handleBarcodeSubmit} className="flex-1 flex items-center gap-2 max-w-2xl">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-600">
                  {isSearching ? (
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Search size={18} />
                  )}
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Scan barcode or type item / SKU (Press Enter to add)..."
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs"
                />
                {searchInput && (
                  <button 
                    type="button"
                    onClick={() => { setSearchInput(''); setSearchResults([]); }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}

                {/* Instant Search Suggestions Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {searchResults.map((prod) => (
                      <div
                        key={prod.id}
                        onClick={() => handleAddToCart(prod)}
                        className="p-3 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between gap-3 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{prod.name}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            {prod.barcode && <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">{prod.barcode}</span>}
                            <span>Stock: {Number(prod.stockQuantity)}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-blue-700 text-sm block">{formatLKR(prod.sellingPrice)}</span>
                          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Click to Add</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Camera Scanner Button */}
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shrink-0"
                title="Camera Scanner"
              >
                <ScanLine size={19} />
              </button>
            </form>

            {/* Quick Action Toolbar */}
            <div className="flex items-center gap-2 shrink-0">
              
              {/* Hold Bill Button */}
              <button
                type="button"
                onClick={handleHoldBill}
                disabled={cart.length === 0}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                  cart.length > 0
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-2xs'
                    : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                }`}
                title="Hold / Suspend current bill (Ctrl+H)"
              >
                <PauseCircle size={16} className={cart.length > 0 ? "text-amber-600" : "text-slate-300"} />
                <span>Hold Bill</span>
              </button>

              {/* Recall Held Bills Button */}
              <button
                type="button"
                onClick={() => setIsRecallModalOpen(true)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                  heldBills.length > 0
                    ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                title="Recall parked bills (Ctrl+R)"
              >
                <PlayCircle size={16} className={heldBills.length > 0 ? "text-blue-600" : "text-slate-400"} />
                <span>Held Bills</span>
                {heldBills.length > 0 && (
                  <span className="bg-blue-600 text-white rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[10px] font-black shadow-2xs">
                    {heldBills.length}
                  </span>
                )}
              </button>

              {/* Clear Cart Button */}
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsClearConfirmOpen(true)}
                  className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors"
                  title="Clear / Void Bill"
                >
                  <Trash2 size={16} />
                </button>
              )}

              {/* POS Mode Switcher: Food City Table vs Touch Tiles */}
              <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setPosMode('SUPERMARKET')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    posMode === 'SUPERMARKET'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Supermarket Counter Table Mode (Food City Style)"
                >
                  <Store size={14} /> Counter
                </button>
                <button
                  type="button"
                  onClick={() => setPosMode('CATALOG')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    posMode === 'CATALOG'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Touch Catalog Tiles Mode"
                >
                  <Grid size={14} /> Tiles
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* --- MODE 1: SUPERMARKET COUNTER TABLE (FOOD CITY STYLE) --- */}
        {posMode === 'SUPERMARKET' ? (
          <div className="flex-1 flex flex-col overflow-hidden p-3 lg:p-4 min-w-0">
            
            {/* Scanned Items Table Container */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden min-w-0">
              
              {/* Scrollable Table Wrapper: guarantees zero wrapping and ample product name width */}
              <div className="flex-1 overflow-x-auto overflow-y-auto min-w-0">
                <div className="min-w-[700px] flex flex-col h-full">
                  
                  {/* Supermarket Table Header */}
                  <div className="flex items-center bg-slate-50 border-b border-slate-200 px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 gap-3 sticky top-0 z-10">
                    <div className="w-8 text-center shrink-0">#</div>
                    <div className="flex-1 min-w-[220px]">Product Description</div>
                    <div className="w-36 shrink-0">Barcode / SKU</div>
                    <div className="w-24 text-right shrink-0">Price (LKR)</div>
                    <div className="w-28 text-center shrink-0">Qty</div>
                    <div className="w-28 text-right shrink-0">Total (LKR)</div>
                    <div className="w-10 text-center shrink-0">Del</div>
                  </div>

                  {/* Table Rows Body */}
                  <div className="flex-1 divide-y divide-slate-100">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 min-h-[300px]">
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 shadow-xs">
                          <Store size={32} />
                        </div>
                        <h3 className="text-base font-bold text-slate-700">Supermarket Billing Counter Ready</h3>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">
                          Scan barcodes or type product names above. Scanned items will be listed line by line in this counter ledger.
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                          <Sparkles size={13} className="text-amber-500" />
                          <span>Use <strong>Hold Bill</strong> anytime to serve another customer</span>
                        </div>
                      </div>
                    ) : (
                      cart.map((item, index) => (
                        <div 
                          key={item.cartItemId}
                          className="flex items-center px-4 py-3 hover:bg-blue-50/40 transition-colors text-sm font-medium gap-3"
                        >
                          {/* Row Index */}
                          <div className="w-8 text-center font-bold text-slate-400 text-xs shrink-0">
                            {index + 1}
                          </div>

                          {/* Name & Details */}
                          <div className="flex-1 min-w-[220px] pr-2">
                            <span className="font-bold text-slate-900 block leading-snug">{item.name}</span>
                            {item.company && (
                              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{item.company}</span>
                            )}
                          </div>

                          {/* Barcode / SKU */}
                          <div className="w-36 shrink-0">
                            <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded truncate block border border-slate-200/60">
                              {item.barcode || item.sku || '—'}
                            </span>
                          </div>

                          {/* Unit Price */}
                          <div className="w-24 text-right font-semibold text-slate-700 shrink-0">
                            {formatLKR(item.sellingPrice)}
                          </div>

                          {/* Quantity Stepper */}
                          <div className="w-28 flex items-center justify-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                              className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors active:scale-95"
                            >
                              <Minus size={13} />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantityDirect(item.cartItemId, e.target.value)}
                              className="w-11 h-7 text-center font-black text-slate-900 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 hide-arrows"
                              min="1"
                            />
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                              className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors active:scale-95"
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          {/* Line Total */}
                          <div className="w-28 text-right font-black text-slate-900 shrink-0">
                            {formatLKR(item.lineSubtotal)}
                          </div>

                          {/* Delete */}
                          <div className="w-10 text-center shrink-0">
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.cartItemId)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Remove item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Fast Quick-Add Chips for Frequent Items */}
              <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 shrink-0">
                  Quick Add:
                </span>
                {catalog.slice(0, 6).map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleAddToCart(prod)}
                    className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors shrink-0 flex items-center gap-1 shadow-2xs"
                  >
                    <Plus size={12} className="text-blue-600" />
                    <span>{prod.name.split(' ')[0]} {prod.name.split(' ')[1] || ''}</span>
                    <span className="text-slate-400 font-normal">({prod.sellingPrice})</span>
                  </button>
                ))}
              </div>

            </div>
          </div>
        ) : (
          /* --- MODE 2: TOUCH CATALOG TILES GRID --- */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category Filter Pills */}
            <div className="flex gap-2 p-3 bg-white border-b border-slate-200 overflow-x-auto shrink-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Products ({catalog.length})
              </button>
              {categories.map((c: any) => {
                const count = catalog.filter((p: any) => p.categoryId === c.id).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === c.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.name} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>

            {/* Catalog Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {(selectedCategory === 'ALL' ? catalog : catalog.filter((p: any) => p.categoryId === selectedCategory)).map(product => {
                  const isOutOfStock = Number(product.stockQuantity) <= 0;
                  return (
                    <div 
                      key={product.id}
                      onClick={() => !isOutOfStock && handleAddToCart(product)}
                      className={`p-3.5 border rounded-2xl shadow-xs flex flex-col justify-between transition-all select-none ${
                        isOutOfStock 
                          ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed' 
                          : 'bg-white border-slate-200/80 hover:border-blue-500 hover:shadow-md active:scale-95 cursor-pointer'
                      }`}
                    >
                      <div>
                        {product.company && (
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                            {product.company}
                          </span>
                        )}
                        <h4 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">{product.name}</h4>
                      </div>
                      
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-end justify-between">
                        <div>
                          <div className="text-blue-700 font-black text-base">{formatLKR(product.sellingPrice)}</div>
                          <div className="text-[11px] text-slate-400">
                            {isOutOfStock ? (
                              <span className="text-rose-600 font-semibold">Out of Stock</span>
                            ) : (
                              <span>Stock: <strong className="text-slate-700">{Number(product.stockQuantity)}</strong></span>
                            )}
                          </div>
                        </div>
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold hover:bg-blue-600 hover:text-white transition-colors">
                          <Plus size={16} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* --- RIGHT COLUMN: SUPERMARKET CHECKOUT STATION --- */}
      <div className="w-full lg:w-[380px] xl:w-[420px] 2xl:w-[450px] h-[55%] lg:h-full flex flex-col bg-white border-l border-slate-200 shrink-0 shadow-lg z-20">
        
        {/* Bill Counter Header */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-blue-600" />
              <span className="font-extrabold text-slate-900 text-base">Active Checkout Bill</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Counter 01 • Cashier: {user?.name?.split(' ')[0] || 'Store'}
            </p>
          </div>
          <Badge variant="neutral" className="px-2.5 py-1 text-xs font-bold bg-white border border-slate-200 text-slate-700">
            {totals.totalItems} {totals.totalItems === 1 ? 'Item' : 'Items'}
          </Badge>
        </div>

        {/* Bill Items Summary Pill in Touch Mode */}
        {posMode === 'CATALOG' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <ShoppingCart size={40} className="text-slate-200 mb-2" />
                <p className="text-xs">Your draft bill is empty.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.cartItemId} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 text-xs truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400">{formatLKR(item.sellingPrice)} × {item.quantity}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-slate-900 text-xs block">{formatLKR(item.lineSubtotal)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Supermarket Grand Total & Quick Tender Calculator */}
        <div className="p-4 bg-white border-t border-slate-200 flex-1 flex flex-col justify-between overflow-y-auto">
          
          <div className="space-y-3">
            {/* Subtotal & Discount Rows */}
            <div className="space-y-1.5 text-xs font-semibold text-slate-600">
              <div className="flex justify-between items-center">
                <span>Subtotal ({totals.totalItems} items)</span>
                <span className="font-extrabold text-slate-900 text-sm">{formatLKR(totals.subtotal)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Order Discount</span>
                <div className="flex items-center gap-1 max-w-[130px]">
                  <span className="text-slate-400 text-xs font-semibold">Rs.</span>
                  <input 
                    type="number" 
                    value={discount || ''}
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    className="w-full text-right border-b border-slate-300 focus:border-blue-500 focus:outline-none font-bold text-slate-900 py-0.5 text-sm hide-arrows"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span>Taxes & VAT (0%)</span>
                <span>LKR 0.00</span>
              </div>
            </div>

            {/* High-Contrast Food City Total Box */}
            <div className="p-4 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 rounded-2xl text-white shadow-md">
              <div className="flex items-center justify-between text-xs text-blue-200 font-bold uppercase tracking-wider">
                <span>Total Amount Due</span>
                <span className="bg-blue-500/30 px-2 py-0.5 rounded text-[10px] text-white">LKR</span>
              </div>
              <div className="text-3xl xl:text-4xl font-black tracking-tight mt-1 truncate">
                {formatLKR(totals.total)}
              </div>
            </div>

            {/* Quick Cash Tender Calculator */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Cash Tendered (Rs.)</span>
                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={totals.total ? totals.total.toString() : "0"}
                  className="w-24 text-right px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:ring-1 focus:ring-blue-500 hide-arrows"
                />
              </div>

              {/* Quick Bill Denominations */}
              <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCashTendered(totals.total.toString())}
                  className="py-1 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 text-slate-700 transition-colors"
                >
                  Exact
                </button>
                <button
                  type="button"
                  onClick={() => setCashTendered('500')}
                  className="py-1 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 text-slate-700 transition-colors"
                >
                  500
                </button>
                <button
                  type="button"
                  onClick={() => setCashTendered('1000')}
                  className="py-1 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 text-slate-700 transition-colors"
                >
                  1,000
                </button>
                <button
                  type="button"
                  onClick={() => setCashTendered('5000')}
                  className="py-1 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 text-slate-700 transition-colors"
                >
                  5,000
                </button>
              </div>

              {/* Real-time Change Due */}
              {parsedTendered > 0 && (
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-extrabold">
                  <span className={changeDue >= 0 ? "text-slate-600" : "text-rose-600"}>
                    {changeDue >= 0 ? "Change Return:" : "Shortage:"}
                  </span>
                  <span className={changeDue >= 0 ? "text-emerald-700 text-sm font-black" : "text-rose-600 text-sm font-black"}>
                    {formatLKR(Math.abs(changeDue))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Checkout Button */}
          <div className="mt-4 pt-2">
            <Button
              className="w-full h-13 text-base font-black shadow-md flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-98"
              disabled={cart.length === 0 || isCheckingOut}
              isLoading={isCheckingOut}
              onClick={handleCheckoutPreview}
            >
              <CreditCard size={18} />
              <span>Proceed to Checkout (F12)</span>
            </Button>
          </div>

        </div>

      </div>

    </div>
  );
};
