import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Printer, MessageCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';
import toast from 'react-hot-toast';
import { formatLKR } from '../../utils/currency';
import { db } from '../../db/offlineDb';
import { ReceiptPreviewModal } from '../../components/ReceiptPreviewModal';
import { WhatsAppShareModal } from '../../components/WhatsAppShareModal';

export const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  useEffect(() => {
    loadOrderDetails();
  }, [id]);

  const loadOrderDetails = async () => {
    setIsLoading(true);
    try {
      if (navigator.onLine) {
        try {
          const res = await apiClient.get(`/orders/${id}/receipt`);
          setOrder(res.data?.id ? res.data : (res.data || res));
          setReceiptData(res.data?.id ? res.data : (res.data || res));
          return;
        } catch (e: any) {
          if (e.response?.status !== 404) throw e;
        }
      }
      
      if (id) {
        const local = await db.localOrders.get(id);
        if (local) {
          setOrder(local.snapshot);
          setReceiptData(local.snapshot);
          return;
        }
      }
      throw new Error('Order not found');
    } catch (error) {
      toast.error('Failed to load order details');
      navigate('/sales');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !order) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/sales')} className="text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            {order.orderNumber}
            <Badge variant="success">{order.status}</Badge>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date(order.createdAt).toLocaleString()} • Cashier: {order.cashier?.name}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" className="gap-2" onClick={() => setIsWhatsAppOpen(true)}>
            <MessageCircle size={18} />
            WhatsApp
          </Button>
          <Button variant="secondary" className="gap-2" onClick={() => setIsReceiptOpen(true)}>
            <Printer size={18} />
            Print Receipt
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Order Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">Item</th>
                    <th className="px-6 py-3 font-medium text-right">Price</th>
                    <th className="px-6 py-3 font-medium text-right">Qty</th>
                    <th className="px-6 py-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{item.productName}</div>
                        {item.sku && <div className="text-xs text-gray-500 mt-0.5">SKU: {item.sku}</div>}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {formatLKR(item.unitPrice)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {Number(item.quantity)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {formatLKR(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatLKR(order.subtotal)}</span>
              </div>
              {Number(order.discountTotal) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span>-{formatLKR(order.discountTotal)}</span>
                </div>
              )}
              {Number(order.taxTotal) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>{formatLKR(order.taxTotal)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-100 flex justify-between font-bold text-gray-900 text-lg">
                <span>Grand Total</span>
                <span>{formatLKR(order.grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Payment</h3>
            <div className="space-y-4">
              {order.payments.map((payment: any) => (
                <div key={payment.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <Badge variant="neutral">{payment.method}</Badge>
                    <Badge variant="success">{payment.status}</Badge>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Amount Paid</span>
                    <span className="font-medium">{formatLKR(payment.amount)}</span>
                  </div>
                  {payment.method === 'CASH' && payment.cashTendered && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Change Given</span>
                      <span>{formatLKR(payment.changeGiven)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Boundaries for Future Implementations */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 opacity-75">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <RefreshCw size={16} /> Returns & Voids
            </h3>
            <p className="text-xs text-gray-500 mb-4">Refund workflows are not available in this phase.</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" disabled>
                Refund
              </Button>
              <Button variant="danger" size="sm" className="flex-1" disabled>
                Void Sale
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isReceiptOpen && receiptData && (
        <ReceiptPreviewModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          orderId={id!}
        />
      )}

      {isWhatsAppOpen && receiptData && (
        <WhatsAppShareModal
          isOpen={isWhatsAppOpen}
          onClose={() => setIsWhatsAppOpen(false)}
          receiptData={receiptData}
        />
      )}
    </div>
  );
};
