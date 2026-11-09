import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ScanLine, Search, Plus, Minus, Trash2, X, ShoppingCart } from 'lucide-react';
import { apiClient } from '../../api/client';
import { formatLKR } from '../../utils/currency';
import toast from 'react-hot-toast';
import { BarcodeScanner } from '../../components/scanner/BarcodeScanner';
import { ConfirmDialog } from '../../components/ui/Modal';
import { CheckoutModal } from './CheckoutModal';
import { ReceiptPreviewModal } from '../../components/ReceiptPreviewModal';
import { useNetwork } from '../../state/NetworkContext';
import { db } from '../../db/offlineDb';
import { useAuth } from '../../state/AuthContext';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sellingPrice: number;
  stockQuantity: number;
  unit: string;
  status: string;
}

interface CartItem extends Product {
  cartItemId: string;
  quantity: number;
  lineDiscount: number;
  lineSubtotal: number;
}

export const POS = () => {
  const { isOnline } = useNetwork();
  const { activeBusiness } = useAuth();
  
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('pos_draft_cart');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const [discount, setDiscount] = useState<number>(() => {
    const saved = localStorage.getItem('pos_draft_discount');
    return saved ? parseFloat(saved) : 0;
  });
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically on mount and after scanner closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow ctrl/cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isScannerOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isScannerOpen]);

  // Persist cart to local storage securely
  useEffect(() => {
    localStorage.setItem('pos_draft_cart', JSON.stringify(cart));
    localStorage.setItem('pos_draft_discount', discount.toString());
  }, [cart, discount]);

  // Centralized frontend calculation pipeline (Mirrors backend logic)
  const calculateTotals = () => {
    let subtotal = 0;
    cart.forEach(item => {
      const gross = Number(item.sellingPrice) * Number(item.quantity);
      const net = Math.max(0, gross - Number(item.lineDiscount));
      subtotal += net;
    });

    const orderDiscount = Math.min(Number(discount) || 0, subtotal);
    const total = subtotal - orderDiscount;
    const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity), 0);

    return { subtotal, orderDiscount, total, totalItems };
  };

  const totals = calculateTotals();

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim().length >= 2) {
        performSearch(searchInput.trim());
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const performSearch = async (term: string) => {
    setIsSearching(true);
    try {
      if (isOnline) {
        try {
          const barcodeRes = await apiClient.get(`/products/barcode/${encodeURIComponent(term)}`);
          const product = barcodeRes.data.data || barcodeRes.data;
          
          if (product) {
            handleAddToCart(product);
            setSearchInput('');
            setSearchResults([]);
            setIsSearching(false);
            return;
          }
        } catch (err) {}

        const res = await apiClient.get('/products', {
          params: { search: term, limit: 10, status: 'ACTIVE' }
        });
        setSearchResults(res.data.products);
      } else {
        // Offline IndexedDB Search
        if (!activeBusiness) return;
        
        // Exact barcode match first
        const barcodeMatch = await db.products
          .where('businessId').equals(activeBusiness.id)
          .and(p => p.barcode === term && p.status === 'ACTIVE')
          .first();
          
        if (barcodeMatch) {
          handleAddToCart(barcodeMatch);
          setSearchInput('');
          setSearchResults([]);
          setIsSearching(false);
          return;
        }

        // Fuzzy text search
        const lowerTerm = term.toLowerCase();
        const results = await db.products
          .where('businessId').equals(activeBusiness.id)
          .filter(p => p.status === 'ACTIVE' && (p.name.toLowerCase().includes(lowerTerm) || !!(p.sku && p.sku.toLowerCase().includes(lowerTerm))))
          .limit(10)
          .toArray();

        setSearchResults(results);
      }
    } catch (error) {
      // Silently ignore to prevent spam
    } finally {
      setIsSearching(false);
    }
  };

  const handleScan = async (code: string) => {
    setIsScannerOpen(false);
    try {
      if (isOnline) {
        const barcodeRes = await apiClient.get(`/products/barcode/${encodeURIComponent(code.trim())}`);
        const product = barcodeRes.data.data || barcodeRes.data;
        handleAddToCart(product);
        toast.success(`Added ${product.name}`);
      } else {
        if (!activeBusiness) return;
        const product = await db.products
          .where('businessId').equals(activeBusiness.id)
          .and(p => p.barcode === code.trim() && p.status === 'ACTIVE')
          .first();
          
        if (product) {
          handleAddToCart(product);
          toast.success(`Added ${product.name} (Offline)`);
        } else {
          toast.error('Product not found in offline catalog.');
        }
      }
    } catch (error: any) {
      if (error.status === 404) {
        toast.error('Product not found in catalog.');
      } else {
        toast.error(error.message || 'Scan failed.');
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
        toast.error(`Not enough stock for ${product.name}. Available: ${product.stockQuantity}`);
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
    if (newQty <= 0) return;
    
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
    setIsClearConfirmOpen(false);
  };

  const handleCheckoutPreview = () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);
  };

  const handleCheckoutSuccess = (orderData: any) => {
    // Clear cart immediately upon successful transaction
    setCart([]);
    setDiscount(0);
    localStorage.removeItem('pos_draft_cart');
    localStorage.removeItem('pos_draft_discount');
    setIsCheckingOut(false);
    setCompletedOrderId(orderData.id);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row bg-gray-100 overflow-hidden -m-4 md:-m-6">
      
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
        title="Clear Cart"
        description="Are you sure you want to remove all items from the current draft?"
        confirmText="Clear Cart"
        isDanger
      />

      {isScannerOpen && (
        <BarcodeScanner 
          onScan={handleScan} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}

      {/* Left Column: Search & Results */}
      <div className="flex-1 flex flex-col h-[40%] lg:h-full border-b lg:border-b-0 lg:border-r border-gray-200 bg-white z-10 relative">
        <div className="p-4 border-b border-gray-100 shadow-sm z-20 shrink-0">
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search size={18} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 lg:py-4 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg transition-colors"
                placeholder="Search products or scan barcode (Ctrl+K)"
                autoComplete="off"
              />
            </div>
            <Button 
              type="button" 
              size="lg"
              variant="secondary"
              onClick={() => setIsScannerOpen(true)}
              title="Camera Scanner"
              className="lg:px-6"
            >
              <ScanLine size={24} />
            </Button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {searchInput.length > 0 && searchResults.length === 0 && !isSearching && (
            <div className="text-center text-gray-500 mt-10">
              No products found matching "{searchInput}"
            </div>
          )}

          {isSearching && (
            <div className="text-center text-gray-400 mt-10 animate-pulse">
              Searching...
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {searchResults.map(product => {
              const isOutOfStock = Number(product.stockQuantity) <= 0;
              return (
                <div 
                  key={product.id}
                  onClick={() => !isOutOfStock && handleAddToCart(product)}
                  className={`relative p-3 border rounded-lg shadow-sm flex flex-col transition-all cursor-pointer 
                    ${isOutOfStock 
                      ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed' 
                      : 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-md active:scale-95'
                    }`}
                >
                  <div className="flex-1 font-medium text-gray-900 leading-tight mb-2">
                    {product.name}
                  </div>
                  <div className="mt-auto">
                    <div className="text-blue-700 font-bold mb-1">{formatLKR(product.sellingPrice)}</div>
                    <div className="text-xs text-gray-500 flex justify-between">
                      <span>{isOutOfStock ? <span className="text-red-600 font-medium">Out of Stock</span> : `Stock: ${Number(product.stockQuantity)}`}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Cart & Checkout */}
      <div className="w-full lg:w-[420px] xl:w-[480px] h-[60%] lg:h-full flex flex-col bg-white">
        <div className="p-3 lg:p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-gray-800 font-semibold text-lg">
            <ShoppingCart size={20} />
            Draft Bill
            <Badge variant="neutral" className="ml-2">{totals.totalItems}</Badge>
          </div>
          {cart.length > 0 && (
            <button 
              onClick={() => setIsClearConfirmOpen(true)}
              className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1 p-1.5 rounded hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} /> Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 lg:p-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center space-y-4">
              <ShoppingCart size={64} className="text-gray-200" />
              <p>Your cart is empty.</p>
              <p className="text-sm">Scan a barcode or search for a product to begin.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.cartItemId} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex flex-col sm:flex-row gap-3 relative group">
                  <button 
                    onClick={() => removeFromCart(item.cartItemId)}
                    className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block shadow-sm hover:bg-red-200 z-10"
                  >
                    <X size={14} />
                  </button>
                  
                  <div className="flex-1 pr-4">
                    <h4 className="font-semibold text-gray-900 leading-tight">{item.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{formatLKR(item.sellingPrice)} per {item.unit}</p>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-3 mt-2 sm:mt-0">
                    <div className="flex items-center border border-gray-300 rounded-md bg-white">
                      <button 
                        onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                        className="w-8 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-l-md active:bg-gray-200"
                      >
                        <Minus size={16} />
                      </button>
                      <input 
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantityDirect(item.cartItemId, e.target.value)}
                        className="w-12 h-9 text-center font-medium text-gray-900 focus:outline-none border-x border-gray-300 hide-arrows"
                        min="0"
                        step="any"
                      />
                      <button 
                        onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                        className="w-8 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-r-md active:bg-gray-200"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    
                    <div className="font-bold text-gray-900 min-w-[90px] text-right text-lg lg:text-base">
                      {formatLKR(item.lineSubtotal)}
                    </div>

                    <button 
                      onClick={() => removeFromCart(item.cartItemId)}
                      className="lg:hidden text-red-500 p-2 ml-1"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border-t border-gray-200 p-4 lg:p-5 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] shrink-0 z-20">
          <div className="space-y-2 mb-4 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-medium text-gray-900">{formatLKR(totals.subtotal)}</span>
            </div>
            
            <div className="flex justify-between items-center text-gray-600">
              <span>Order Discount</span>
              <div className="flex items-center max-w-[120px]">
                <span className="mr-2 text-gray-500">Rs.</span>
                <input 
                  type="number" 
                  value={discount || ''}
                  onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-full text-right border-b border-gray-300 focus:border-blue-500 focus:outline-none font-medium text-gray-900 py-1 hide-arrows"
                />
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-3 flex justify-between items-end mt-3">
              <span className="text-gray-800 font-semibold text-lg">Total</span>
              <span className="text-3xl lg:text-4xl font-black text-blue-700">{formatLKR(totals.total)}</span>
            </div>
          </div>

          <Button 
            className="w-full h-14 text-lg font-bold shadow-md flex items-center justify-center gap-2"
            disabled={cart.length === 0 || isCheckingOut}
            isLoading={isCheckingOut}
            onClick={handleCheckoutPreview}
          >
            Proceed to Checkout
          </Button>
        </div>
      </div>
      
    </div>
  );
};
