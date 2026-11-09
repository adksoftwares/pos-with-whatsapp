import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { CheckCircle, CreditCard, Banknote, QrCode } from 'lucide-react';
import { apiClient } from '../../api/client';
import { formatLKR } from '../../utils/currency';
import toast from 'react-hot-toast';
import { useNetwork } from '../../state/NetworkContext';
import { SyncService } from '../../services/syncService';
import { useAuth } from '../../state/AuthContext';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: any[];
  orderDiscount: number;
  onSuccess: (orderData: any) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ 
  isOpen, 
  onClose, 
  cartItems, 
  orderDiscount,
  onSuccess
}) => {
  const [step, setStep] = useState<'VALIDATING' | 'PAYMENT' | 'SUCCESS'>('VALIDATING');
  const [serverTotals, setServerTotals] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [reference, setReference] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Idempotency key to prevent double charging
  const [idempotencyKey] = useState(() => Math.random().toString(36).substring(2) + Date.now().toString(36));

  const { isOnline } = useNetwork();
  const { activeBusiness } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setStep('VALIDATING');
      validateCart();
    }
  }, [isOpen]);

  const validateCart = async () => {
    try {
      const payload = {
        items: cartItems.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          lineDiscount: item.lineDiscount
        })),
        orderDiscountAmount: orderDiscount
      };

      if (isOnline) {
        const res = await apiClient.post('/orders/preview', payload) as any;
        const data = res.data; // apiClient interceptor returns response.data; res = {success,message,data}
        setServerTotals(data);
        // setAmountTendered(String(data.grandTotal));
      } else {
        // Offline validation fallback
        const subtotal = cartItems.reduce((sum, item) => sum + (item.sellingPrice * item.quantity - item.lineDiscount), 0);
        const tax = 0;
        const grandTotal = subtotal - orderDiscount + tax;
        
        setServerTotals({
          validatedItems: cartItems.map(item => ({
            productId: item.id,
            name: item.name,
            sku: item.sku,
            barcode: item.barcode,
            unit: item.unit,
            unitPrice: item.sellingPrice,
            quantity: item.quantity,
            lineDiscount: item.lineDiscount,
            netLineTotal: item.sellingPrice * item.quantity - item.lineDiscount,
          })),
          subtotal,
          discountAmount: orderDiscount,
          tax,
          grandTotal,
          totalItems: cartItems.length,
          totalQuantity: cartItems.reduce((sum, i) => sum + i.quantity, 0)
        });
        // setAmountTendered(grandTotal.toString());
      }
      
      setStep('PAYMENT');
    } catch (error: any) {
      toast.error(error.message || 'Validation failed. Stock or prices may have changed.');
      onClose();
    }
  };

  const handleCheckout = async () => {
    if (!serverTotals) return;
    
    const grandTotal = Number(serverTotals.grandTotal);
    const tendered = Number(amountTendered);
    
    if (paymentMethod === 'CASH') {
      if (isNaN(tendered) || tendered < grandTotal) {
        toast.error('Insufficient cash tendered.');
        return;
      }
    }

    setIsProcessing(true);
    
    try {
      const payload = {
        clientTransactionId: idempotencyKey, // Use our ID as client ID
        items: cartItems.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          lineDiscount: item.lineDiscount
        })),
        orderDiscountAmount: orderDiscount,
        paymentMethod,
        amountTendered: paymentMethod === 'CASH' ? tendered : grandTotal,
        referenceNumber: reference || undefined
      };

      if (isOnline) {
        const res = await apiClient.post('/orders', payload, {
          headers: {
            'X-Idempotency-Key': idempotencyKey
          }
        }) as any;
        
        setStep('SUCCESS');
        onSuccess({ id: res.data?.id || res.data }); // res.data is the order object
      } else {
        // Offline Checkout
        if (!activeBusiness) return;
        
        // Build receipt snapshot so we can print it offline
        const snapshot = {
          id: idempotencyKey, // Used for offline routing
          clientTransactionId: idempotencyKey,
          business: {
            name: activeBusiness.name,
            currency: activeBusiness.currency || 'LKR',
          },
          orderNumber: `OFF-${idempotencyKey.slice(-6).toUpperCase()}`,
          completedAt: new Date().toISOString(),
          subtotal: serverTotals.subtotal,
          discountTotal: serverTotals.discountAmount,
          taxTotal: serverTotals.tax,
          grandTotal: serverTotals.grandTotal,
          items: serverTotals.validatedItems,
          payments: [{ method: paymentMethod, amount: paymentMethod === 'CASH' ? tendered : grandTotal, status: 'PAID' }],
          cashTendered: paymentMethod === 'CASH' ? tendered : undefined,
          changeAmount: paymentMethod === 'CASH' ? Math.max(0, tendered - grandTotal) : undefined,
          offline: true
        };

        await SyncService.queueOrder(activeBusiness.id, payload, snapshot);
        
        toast.success('Sale saved offline. Will sync when online.');
        setStep('SUCCESS');
        onSuccess({ id: snapshot.clientTransactionId }); // Send offline id
      }
      
    } catch (error: any) {
      toast.error(error.message || 'Checkout failed.');
      setIsProcessing(false);
    }
  };

  const calculateChange = () => {
    if (!serverTotals || paymentMethod !== 'CASH') return 0;
    const tendered = Number(amountTendered);
    if (isNaN(tendered)) return 0;
    return Math.max(0, tendered - serverTotals.grandTotal);
  };

  const renderValidating = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600 font-medium">Validating cart against current stock...</p>
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-8">
      <CheckCircle size={64} className="text-green-500 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Sale Completed</h2>
      <p className="text-gray-500 mb-8">The transaction was successful.</p>
      
      <div className="flex gap-4 w-full">
        <Button className="flex-1" onClick={onClose} size="lg">New Sale</Button>
      </div>
    </div>
  );

  const renderPayment = () => {
    if (!serverTotals) return null;
    
    const change = calculateChange();
    const isExact = paymentMethod === 'CASH' && Number(amountTendered) === serverTotals.grandTotal;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
        
        {/* Left: Summary */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Bill Summary</h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Items ({serverTotals.totalItems})</span>
              <span>{formatLKR(serverTotals.subtotal)}</span>
            </div>
            
            {serverTotals.orderDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span>-{formatLKR(serverTotals.orderDiscount)}</span>
              </div>
            )}
            
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="flex justify-between items-end">
                <span className="text-gray-900 font-bold">Total to Pay</span>
                <span className="text-3xl font-black text-blue-700">{formatLKR(serverTotals.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Payment */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                  paymentMethod === 'CASH' 
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Banknote size={24} />
                <span className="font-medium text-sm">Cash</span>
              </button>
              
              <button
                type="button"
                onClick={() => setPaymentMethod('CARD')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                  paymentMethod === 'CARD' 
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <CreditCard size={24} />
                <span className="font-medium text-sm">Card</span>
              </button>
              
              <button
                type="button"
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                  paymentMethod === 'BANK_TRANSFER' 
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <div className="font-bold text-lg leading-none mt-1">G</div>
                <span className="font-medium text-sm">Bank Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('QR')}
                className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                  paymentMethod === 'QR' 
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <QrCode size={24} />
                <span className="font-medium text-sm">QR Code</span>
              </button>
            </div>
          </div>

          {paymentMethod === 'CASH' && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash Received (Rs.)</label>
                <input
                  type="number"
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                  autoFocus
                  className="block w-full px-4 py-3 border border-gray-300 rounded-md leading-5 bg-white font-bold text-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hide-arrows"
                  min={serverTotals.grandTotal}
                  step="any"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setAmountTendered(serverTotals.grandTotal.toString())}
                >
                  Exact
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setAmountTendered('1000')}>1K</Button>
                <Button variant="secondary" size="sm" onClick={() => setAmountTendered('2000')}>2K</Button>
                <Button variant="secondary" size="sm" onClick={() => setAmountTendered('5000')}>5K</Button>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Change Due:</span>
                <div className="flex items-center gap-2">
                  {isExact && <Badge variant="success">Exact</Badge>}
                  <span className="text-xl font-bold text-gray-900">{formatLKR(change)}</span>
                </div>
              </div>
            </div>
          )}

          {paymentMethod !== 'CASH' && (
            <div className="pt-2 border-t border-gray-100">
              <Input 
                label="Reference Number (Optional)"
                placeholder="Transaction ID / Slip No"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              size="lg" 
              onClick={handleCheckout} 
              isLoading={isProcessing}
              disabled={paymentMethod === 'CASH' && (isNaN(Number(amountTendered)) || Number(amountTendered) < serverTotals.grandTotal)}
            >
              Complete Sale
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => { if (!isProcessing && step !== 'SUCCESS') onClose(); }} 
      title={step === 'SUCCESS' ? '' : 'Checkout'} 
      maxWidth={step === 'SUCCESS' ? 'md' : '3xl'}
    >
      {step === 'VALIDATING' && renderValidating()}
      {step === 'PAYMENT' && renderPayment()}
      {step === 'SUCCESS' && renderSuccess()}
    </Modal>
  );
};
