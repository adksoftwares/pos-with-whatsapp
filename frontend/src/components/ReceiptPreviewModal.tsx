import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
'use client';
import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Printer, Download, Receipt, MessageCircle } from 'lucide-react';
import { WhatsAppShareModal } from './WhatsAppShareModal';




import { apiClient } from '../api/client';
import { db } from '../db/offlineDb';

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

export function ReceiptPreviewModal({ isOpen, onClose, orderId }: ReceiptPreviewModalProps) {
  const [invoice, setInvoice] = useState<any>(null);
  const [rawReceipt, setRawReceipt] = useState<any>(null);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !orderId) return;
    const loadData = async () => {
      setIsLoading(true);
      let data = null;
      if (navigator.onLine) {
        try {
          const res = await apiClient.get('/orders/' + orderId + '/receipt');
          data = res.data?.id ? res.data : (res.data || res);
        } catch (e) {}
      }
      if (!data) {
        const local = await db.localOrders.get(orderId);
        if (local) data = local.snapshot;
      }
      
      if (data) {
        setRawReceipt(data);
        setUser({
          shopName: data.business?.name || 'Shop Name',
          shopAddress: data.business?.address || 'Address',
          shopPhone: data.business?.phone || '',
          shopFax: '',
          name: data.cashier?.name || 'System'
        });
        
        const payment = data.payments && data.payments.length > 0 ? data.payments[0] : null;
        
        setInvoice({
          invoiceNumber: data.orderNumber,
          createdAt: data.completedAt || data.createdAt,
          paymentMethod: payment?.method || 'CASH',
          status: payment?.status || 'PAID',
          items: data.items.map((i: any) => ({
            id: i.id || i.productId,
            companyName: i.company || i.product?.company || 'Uncategorized',
            productName: i.productName || i.name,
            code: i.sku || i.barcode,
            discount: Number(i.lineDiscount) || 0,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
            finalTotal: Number(i.lineTotal || i.netLineTotal)
          })),
          subtotal: Number(data.subtotal),
          totalDiscount: Number(data.discountTotal || data.orderDiscount || 0),
          grandTotal: Number(data.grandTotal),
          amountReceived: payment?.amount !== undefined ? Number(payment.amount) : Number(data.cashTendered),
          balance: Number(payment?.changeGiven || data.changeAmount || 0)
        });
      }
      setIsLoading(false);
    };
    loadData();
  }, [isOpen, orderId]);

  

  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm');
  const [dynamicHeightMm, setDynamicHeightMm] = useState<number | 'auto'>('auto');
  const receiptRef = useRef<HTMLDivElement>(null);

  // Measure the exact pixel height of the receipt and convert to mm for the browser print preview
  useEffect(() => {
    const measureHeight = () => {
      if (receiptRef.current) {
        // 1 pixel = 0.264583 mm (standard 96 DPI screen)
        // We add a tiny 5mm buffer at the bottom for the printer cutter
        const heightInMm = Math.ceil(receiptRef.current.offsetHeight * 0.264583) + 5;
        setDynamicHeightMm(heightInMm);
      }
    };

    // Small delay to ensure fonts/layout are fully painted
    const timer = setTimeout(measureHeight, 150);
    return () => clearTimeout(timer);
  }, [invoice, paperSize]);

  if (!isOpen) return null;
  if (isLoading) return <div className="fixed inset-0 z-50 bg-gray-900/50 flex items-center justify-center"><div className="bg-white p-4 rounded text-black">Loading receipt...</div></div>;
  if (!invoice) return <div className="fixed inset-0 z-50 bg-gray-900/50 flex items-center justify-center"><div className="bg-white p-4 rounded text-black">Receipt not found. <button onClick={onClose} className="ml-2 text-blue-500">Close</button></div></div>;

              const generateImageBlob = async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;
    try {
      console.log('Starting html2canvas...');
      const canvas = await html2canvas(receiptRef.current, { 
        scale: 3, 
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      console.log('Canvas generated. Converting to blob...');
      return await Promise.race([
        new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(blob => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob returned null'));
            }
          }, 'image/png');
        }),
        new Promise<Blob>((_, reject) => setTimeout(() => reject(new Error('Image generation timed out')), 5000))
      ]);
    } catch (err) {
      console.error('html2canvas error:', err);
      throw err;
    }
  };

    const handleOpenWhatsApp = async () => {
    const toastId = toast.loading('Preparing receipt...');
    const blob = await generateImageBlob();
    setRawReceipt({ ...rawReceipt, imageBlob: blob });
    toast.dismiss(toastId);
    setIsWhatsAppOpen(true);
  };

  const generatePDF = (returnBlob = false): any => {
    if (!invoice || !user) return;
    const width = paperSize === '80mm' ? 80 : 58;
    
    // Helper to render and return final Y position
    const renderContent = (doc: jsPDF, isDummy: boolean) => {
      const margin = width === 80 ? 4 : 2;
      const center = width / 2;
      
      const titleSize = width === 80 ? 14 : 12;
      const normalSize = width === 80 ? 9 : 8;
      const smallSize = width === 80 ? 8 : 7;
      
      doc.setFontSize(titleSize);
      doc.setFont("helvetica", "bold");
      doc.text(user.shopName || "SHOP NAME", center, 10, { align: "center" });
      
      doc.setFontSize(normalSize);
      doc.setFont("helvetica", "normal");
      doc.text(user.shopAddress || "Address", center, 15, { align: "center" });
      doc.text(`Tel: ${user.shopPhone || ""}`, center, 19, { align: "center" });
      if (user.shopFax) {
        doc.text(`Fax: ${user.shopFax}`, center, 23, { align: "center" });
        doc.setLineWidth(0.3);
        doc.line(margin, 26, width - margin, 26);
      } else {
        doc.setLineWidth(0.3);
        doc.line(margin, 22, width - margin, 22);
      }
      
      let currentY = user.shopFax ? 30 : 26;
      doc.setFontSize(smallSize);
      
      doc.text(`Inv: ${invoice.invoiceNumber}`, margin, currentY);
      currentY += 4;
      
      doc.text(`Cashier: ${user.name}`, margin, currentY);
      currentY += 4;
      
      doc.text(`Pay: ${invoice.paymentMethod}`, margin, currentY);
      currentY += 4;
      
      doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}   ${new Date(invoice.createdAt).toLocaleTimeString()}`, margin, currentY);
      currentY += 3; // buffer before table
      
      const tableStartY = currentY;

      const tableData: any[] = [];
      const itemsByCompany = invoice.items.reduce((acc: any, item: any) => {
        if (!acc[item.companyName]) acc[item.companyName] = [];
        acc[item.companyName].push(item);
        return acc;
      }, {});

      Object.keys(itemsByCompany).forEach((company) => {
        tableData.push([
          { content: company, colSpan: 4, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', textColor: [0, 0, 0], cellPadding: 1 } }
        ]);
        itemsByCompany[company].forEach((item: any) => {
          let name = item.productName;
          if (item.weight) name += ` (${item.weight})`;
          if (item.code) name += `\nCode: ${item.code}`;
          if (item.discount > 0) name += `\nDis: -Rs.${item.discount.toFixed(2)}`;
          tableData.push([
            name,
            item.quantity.toString(),
            item.unitPrice.toFixed(2),
            item.finalTotal.toFixed(2)
          ]);
        });
      });

      autoTable(doc, {
        startY: tableStartY,
        margin: { left: margin, right: margin },
        head: [['Item', 'Qty', 'Price', 'Total']],
        body: tableData,
        theme: 'plain',
        headStyles: { fillColor: [220, 220, 220], textColor: [0,0,0], fontStyle: 'bold', cellPadding: 1 },
        styles: { fontSize: smallSize, cellPadding: 1, textColor: [0,0,0], overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: width === 80 ? 32 : 22 },
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' }
        }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 5;
      
      doc.setFont("helvetica", "normal");
      doc.text("Subtotal:", margin, finalY);
      doc.text(`Rs. ${invoice.subtotal.toFixed(2)}`, width - margin, finalY, { align: "right" });
      finalY += 4;
      
      doc.text("Total Discount:", margin, finalY);
      doc.text(`- Rs. ${invoice.totalDiscount.toFixed(2)}`, width - margin, finalY, { align: "right" });
      finalY += 5;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(normalSize + 1);
      doc.text("GRAND TOTAL:", margin, finalY);
      doc.text(`Rs. ${invoice.grandTotal.toFixed(2)}`, width - margin, finalY, { align: "right" });
      finalY += 6;
      
      doc.setFontSize(smallSize);
      doc.setFont("helvetica", "normal");
      
      if (invoice.paymentMethod === 'CASH') {
        doc.text("Cash Received:", margin, finalY);
        doc.text(`Rs. ${invoice.amountReceived?.toFixed(2) || '0.00'}`, width - margin, finalY, { align: "right" });
        finalY += 4;
        doc.setFont("helvetica", "bold");
        doc.text("Balance / Change:", margin, finalY);
        doc.text(`Rs. ${invoice.balance?.toFixed(2) || '0.00'}`, width - margin, finalY, { align: "right" });
        finalY += 6;
      }

      finalY += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Thank you for your purchase!", center, finalY, { align: "center" });
      finalY += 6;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(width === 80 ? 7 : 6);
      doc.setTextColor(100, 100, 100);
      doc.text("System by ADK Software Solutions", center, finalY, { align: "center" });
      finalY += 3;
      doc.text("adksoftwares.com | contact@adksoftwares.com", center, finalY, { align: "center" });
      
      if (!isDummy) {
        doc.link(center - 15, finalY - 6, 30, 4, { url: 'https://adksoftwares.com/' });
        doc.link(center - 15, finalY - 3, 30, 4, { url: 'mailto:contact@adksoftwares.com' });
      }
      
      // Return absolute final physical height used
      return finalY + 5; 
    };

    // First pass to get exact height needed
    const dummyDoc = new jsPDF({ format: [width, 1000], unit: 'mm' });
    const exactHeight = renderContent(dummyDoc, true);
    
    // Second pass to generate final PDF cropped tightly to the content
    const doc = new jsPDF({ format: [width, exactHeight], unit: 'mm' });
    renderContent(doc, false);
    if (returnBlob) return doc.output('blob');
      doc.save(`Invoice_${invoice.invoiceNumber}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Convert mm to Tailwind/CSS pixels for screen preview (rough estimation)
  // 80mm ~ 302px, 58mm ~ 219px.
  const previewWidthClass = paperSize === '80mm' ? 'w-[300px]' : 'w-[220px]';
  
  const fSize = paperSize === '80mm' ? {
    header: '15px',
    base: '11px',
    small: '10px',
    tiny: '9px',
  } : {
    header: '13px',
    base: '9px',
    small: '8px',
    tiny: '7px',
  };

  return (
    <>
      <style type="text/css" media="print">
        {`
          @page {
            /* Force exact thermal dimensions. No A4 fallback. */
            size: ${paperSize} ${dynamicHeightMm === 'auto' ? 'auto' : `${dynamicHeightMm}mm`};
            margin: 0 !important;
          }
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
          /* Strip all UI, explicitly set modal wrapper to standard block */
          .thermal-print-wrapper {
            position: static !important;
            display: block !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
        `}
      </style>

      {/* 
        This wrapper is a standard modal on screen, but strips entirely into a plain document during print 
        to avoid flexing/absolute positioning from forcing 100vh height.
      */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50 flex justify-center p-4 thermal-print-wrapper">
        <div className="flex flex-col h-fit my-auto items-center thermal-print-wrapper">
          
          {/* Action buttons (hidden when printing) */}
          <div className="bg-white rounded-t-lg shadow-xl p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden w-full max-w-lg mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <Receipt className="w-5 h-5 mr-2" /> Receipt
            </h2>
            <div className="flex flex-wrap gap-2 justify-center">
              <select 
                value={paperSize} 
                onChange={(e) => setPaperSize(e.target.value as '80mm' | '58mm')}
                className="bg-gray-100 border-gray-300 rounded text-sm px-2 py-1"
              >
                <option value="80mm">80mm Paper</option>
                <option value="58mm">58mm Paper</option>
              </select>
              <button onClick={handleOpenWhatsApp} className="bg-green-600 text-white px-3 py-1.5 rounded flex items-center hover:bg-green-700 text-sm">
                  <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                </button>
              <button onClick={() => generatePDF()} className="bg-red-600 text-white px-3 py-1.5 rounded flex items-center hover:bg-red-700 text-sm">
                <Download className="w-4 h-4 mr-1" /> PDF
              </button>
              <button onClick={handlePrint} className="bg-blue-600 text-white px-3 py-1.5 rounded flex items-center hover:bg-blue-700 text-sm">
                <Printer className="w-4 h-4 mr-1" /> Print
              </button>
              <button onClick={onClose} className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded hover:bg-gray-300 text-sm">
                Close
              </button>
            </div>
          </div>

          {/* Actual HTML Thermal Invoice Content */}
          <div 
            ref={receiptRef}
            className={`bg-white shadow-2xl print:shadow-none print:m-0 text-black mx-auto print:w-full print:h-auto ${previewWidthClass}`}
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            <div style={{ padding: '4mm' }}>
              
              {/* ── HEADER ── */}
              <div style={{ textAlign: 'center', marginBottom: '3mm', borderBottom: '1px dashed #000', paddingBottom: '2mm' }}>
                <div style={{
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontSize: fSize.header,
                  lineHeight: '1.2',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {user?.shopName}
                </div>
                <div style={{ fontSize: fSize.base, marginTop: '3px', lineHeight: '1.3' }}>
                  {user?.shopAddress}
                </div>
                <div style={{ fontSize: fSize.base, lineHeight: '1.3' }}>Tel: {user?.shopPhone}</div>
                {user?.shopFax && (
                  <div style={{ fontSize: fSize.base, lineHeight: '1.3' }}>Fax: {user.shopFax}</div>
                )}
              </div>

              {/* ── INV META ── */}
              <div style={{
                borderBottom: '1px dashed #000',
                paddingBottom: '2mm',
                marginBottom: '2mm',
                fontSize: fSize.small,
                lineHeight: '1.5'
              }}>
                <div style={{ wordBreak: 'break-all' }}>
                  Inv: <strong>{invoice.invoiceNumber}</strong>
                </div>
                <div>Cashier: {user?.name}</div>
                <div>Pay: {invoice.paymentMethod}</div>
                <div style={{ marginTop: '2px' }}>
                  Date: {new Date(invoice.createdAt).toLocaleDateString()} &nbsp; {new Date(invoice.createdAt).toLocaleTimeString()}
                </div>
              </div>

              {/* ── ITEMS TABLE ── */}
              <div style={{ marginBottom: '2mm' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fSize.small, tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '48%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom: '1px dashed #000' }}>
                      <th style={{ textAlign: 'left', padding: '1px 2px 1px 0', fontWeight: 'bold' }}>Item</th>
                      <th style={{ textAlign: 'center', padding: '1px 1px', fontWeight: 'bold' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '1px 1px', fontWeight: 'bold' }}>Price</th>
                      <th style={{ textAlign: 'right', padding: '1px 0 1px 1px', fontWeight: 'bold' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      invoice.items?.reduce((acc: any, item: any) => {
                        if (!acc[item.companyName]) acc[item.companyName] = [];
                        acc[item.companyName].push(item);
                        return acc;
                      }, {}) || {}
                    ).map(([company, items]: [string, any]) => (
                      <React.Fragment key={company}>
                        <tr>
                          <td colSpan={4} style={{ padding: '3px 0 1px 0', fontWeight: 'bold', fontSize: fSize.tiny, borderBottom: '1px solid #eee' }}>
                            {company}
                          </td>
                        </tr>
                        {items.map((item: any) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '2px 2px 2px 0', verticalAlign: 'top', wordBreak: 'break-word' }}>
                              <div style={{ fontWeight: '600' }}>{item.productName}{item.weight ? ` (${item.weight})` : ''}</div>
                              {item.code && (
                                <div style={{ fontSize: fSize.tiny, color: '#333' }}>Code: {item.code}</div>
                              )}
                              {item.discount > 0 && (
                                <div style={{ fontSize: fSize.tiny, color: '#555' }}>Dis: -Rs.{item.discount.toFixed(2)}</div>
                              )}
                            </td>
                            <td style={{ padding: '2px 1px', textAlign: 'center', verticalAlign: 'top' }}>{item.quantity}</td>
                            <td style={{ padding: '2px 1px', textAlign: 'right', verticalAlign: 'top' }}>{item.unitPrice.toFixed(2)}</td>
                            <td style={{ padding: '2px 0 2px 1px', textAlign: 'right', verticalAlign: 'top', fontWeight: '600' }}>{item.finalTotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── TOTALS ── */}
              <div style={{ borderTop: '1px dashed #000', paddingTop: '2mm', fontSize: fSize.small, lineHeight: '1.6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>Rs. {invoice.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Discount:</span>
                  <span>- Rs. {invoice.totalDiscount.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: fSize.base, borderTop: '1px solid #ccc', paddingTop: '2px', marginTop: '2px' }}>
                  <span>GRAND TOTAL:</span>
                  <span>Rs. {invoice.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* 🔥 PAYMENT 🔥 */}
              <div style={{ borderTop: '1px dashed #000', paddingTop: '2mm', marginTop: '2mm', fontSize: fSize.small, lineHeight: '1.6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Payment Method:</span>
                  <span style={{ fontWeight: 'bold' }}>{invoice.paymentMethod}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Payment Status:</span>
                  <span style={{ fontWeight: 'bold' }}>{invoice.status || 'PAID'}</span>
                </div>
                {invoice.paymentMethod === 'CASH' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Amount Received:</span>
                      <span>Rs. {invoice.amountReceived?.toFixed(2) || '0.00'}</span>
                    </div>
                    {invoice.amountReceived >= invoice.grandTotal ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span>Change / Refund Due:</span>
                        <span>Rs. {(invoice.amountReceived - invoice.grandTotal).toFixed(2)}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span>Balance Due:</span>
                        <span>Rs. {invoice.balance?.toFixed(2) || '0.00'}</span>
                      </div>
                    )}
                  
      {isWhatsAppOpen && rawReceipt && (
        <WhatsAppShareModal
          isOpen={isWhatsAppOpen}
          onClose={() => setIsWhatsAppOpen(false)}
          receiptData={rawReceipt}
          
          
        />
      )}
    </>
                )}
              </div>

              {/* ── FOOTER ── */}
              <div style={{ textAlign: 'center', marginTop: '4mm', paddingTop: '2mm', borderTop: '1px solid #000' }}>
                <p style={{ fontWeight: 'bold', fontSize: fSize.small }}>Thank you for your purchase!</p>
                <div style={{ marginTop: '3px', fontSize: fSize.tiny, color: '#666', lineHeight: '1.4' }}>
                  <p>System by ADK Software Solutions</p>
                  <p>adksoftwares.com | contact@adksoftwares.com</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}