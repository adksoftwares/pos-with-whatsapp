import React from 'react';

interface ReceiptTemplateProps {
  receiptData: any;
  settings?: any;
  width: '58mm' | '80mm';
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ receiptData, settings: _settings, width }) => {
  if (!receiptData) return null;

  const { business, cashier, items, payments } = receiptData;
  const payment = payments && payments.length > 0 ? payments[0] : null;

  const containerClass = width === '58mm' ? 'w-[58mm] text-[11px]' : 'w-[80mm] text-[13px]';
  
  // Group items by company
  const itemsByCompany: Record<string, any[]> = {};
  items.forEach((item: any) => {
    const company = item.company || item.product?.company || 'Uncategorized';
    if (!itemsByCompany[company]) {
      itemsByCompany[company] = [];
    }
    itemsByCompany[company].push(item);
  });

  return (
    <div className={`receipt-container font-mono text-black bg-white mx-auto overflow-hidden leading-tight ${containerClass}`}>
      
      {/* 1. Header */}
      <div className="text-center mb-4">
        <h2 className="font-bold text-lg mb-1">{business.name}</h2>
        {business.address && <div className="break-words">{business.address}</div>}
        {business.city && <div className="break-words">{business.city}, {business.country}</div>}
        {business.phone && <div>Tel & Fax: {business.phone}</div>}
      </div>

      {/* 2. Invoice Info */}
      <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
        <div className="flex justify-between">
          <span>Invoice No:</span>
          <span className="font-bold">{receiptData.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Cashier:</span>
          <span>{cashier?.name || 'System'}</span>
        </div>
        <div className="flex justify-between">
          <span>Date & Time:</span>
          <span>
            {new Date(receiptData.completedAt || receiptData.createdAt).toLocaleDateString()} 
            {' '}
            {new Date(receiptData.completedAt || receiptData.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* 3. Item Details */}
      <div className="mb-2">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-dashed border-gray-400">
              <th className="py-1 font-semibold w-full">ITEM / CODE</th>
              <th className="py-1 font-semibold text-right pr-2">QTY</th>
              <th className="py-1 font-semibold text-right pr-2">PRICE</th>
              <th className="py-1 font-semibold text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(itemsByCompany).map(([company, companyItems]) => (
              <React.Fragment key={company}>
                {/* Company Header */}
                <tr>
                  <td colSpan={4} className="py-1 font-bold underline italic text-[12px] pt-2 pb-1">
                    {company}
                  </td>
                </tr>
                {/* Items for this company */}
                {companyItems.map((item: any) => (
                  <tr key={item.id || item.productId} className="align-top">
                    <td className="py-1 pr-1 break-words">
                      <div>{item.productName || item.name}</div>
                      {(item.sku || item.barcode) && (
                        <div className="text-[10px] text-gray-600">[{item.sku || item.barcode}]</div>
                      )}
                      {Number(item.lineDiscount) > 0 && (
                        <div className="text-[10px] italic">Dis: -Rs.{Number(item.lineDiscount).toFixed(2)}</div>
                      )}
                    </td>
                    <td className="py-1 text-right pr-1 whitespace-nowrap">{Number(item.quantity)}</td>
                    <td className="py-1 text-right pr-1 whitespace-nowrap">{Number(item.unitPrice).toFixed(2)}</td>
                    <td className="py-1 text-right whitespace-nowrap">{Number(item.lineTotal || item.netLineTotal).toFixed(2)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. Totals */}
      <div className="border-t border-dashed border-gray-400 pt-2 mb-4 space-y-1">
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>{Number(receiptData.subtotal).toFixed(2)}</span>
        </div>
        
        {Number(receiptData.discountTotal || receiptData.orderDiscount) > 0 && (
          <div className="flex justify-between font-semibold">
            <span>Total Discount</span>
            <span>-{Number(receiptData.discountTotal || receiptData.orderDiscount).toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between font-bold text-[14px] mt-2 pt-1 border-t-2 border-gray-800">
          <span>GRAND TOTAL</span>
          <span>{Number(receiptData.grandTotal).toFixed(2)}</span>
        </div>
      </div>

      {/* 5. Payment Details */}
      {payment && (
        <div className="border-b border-dashed border-gray-400 pb-2 mb-4 space-y-1">
          <div className="flex justify-between">
            <span>Payment Method</span>
            <span>{payment.method}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment Status</span>
            <span>{payment.status || 'PAID'}</span>
          </div>
          {payment.method === 'CASH' && (payment.amount !== undefined || receiptData.cashTendered !== undefined) && (
            <>
              <div className="flex justify-between">
                <span>Amount Received</span>
                <span>{Number(payment.amount || receiptData.cashTendered).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Change / Due</span>
                <span>{Number(payment.changeGiven || receiptData.changeAmount || 0).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* 6. Footer */}
      <div className="text-center mt-4 mb-2">
        <div className="font-bold text-[12px]">Thank you for your purchase!</div>
        <div className="text-[10px] mt-3">System by ADK Software Solutions</div>
      </div>

    </div>
  );
};
