import React, { useState } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  BarChart3, Receipt, CreditCard, Building2, Package, 
  Wallet, List, AlertTriangle, Clock, Activity,
  Truck, FileText, ArrowLeft
} from 'lucide-react';
import { SalesSummaryReport } from './components/SalesSummaryReport';
import { ProductSalesReports } from './components/ProductSalesReports';
import { PaymentMethodsReport } from './components/PaymentMethodsReport';

// Placeholders for reports that just redirect or are under construction
const ComingSoon = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
    <div className="bg-gray-100 p-4 rounded-full mb-4">
      <Activity size={32} className="text-gray-400" />
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-500">This report is currently under construction. Check back soon!</p>
  </div>
);

const REPORT_CATEGORIES = [
  {
    title: '1. Sales Reports',
    description: 'Track your revenue, invoices, and sales performance',
    reports: [
      { id: 'sales_summary', title: 'Sales Summary', desc: 'Net sales, discounts, tax over time', icon: BarChart3, component: SalesSummaryReport },
      { id: 'invoice_sales', title: 'Invoice / Bill-wise Sales', desc: 'Sales breakdown by individual invoices', icon: Receipt, component: null, link: '/sales' },
      { id: 'payment_methods', title: 'Payment Methods', desc: 'Revenue grouped by Cash, Card, QR, etc.', icon: CreditCard, component: PaymentMethodsReport },
      { id: 'company_sales', title: 'Company-wise Sales', desc: 'Sales grouped by brand/company', icon: Building2, component: ComingSoon },
      { id: 'product_sales', title: 'Product-wise Sales', desc: 'Quantity and revenue by product', icon: Package, component: ProductSalesReports },
    ]
  },
  {
    title: '2. Inventory & Products',
    description: 'Monitor stock levels, values, and product ledger',
    reports: [
      { id: 'stock_value', title: 'Current Stock Value', desc: 'Review products and current inventory value', icon: Wallet, component: null, link: '/products' },
      { id: 'product_list', title: 'Complete Product List', desc: 'All products and current stock', icon: List, component: null, link: '/products' },
      { id: 'out_of_stock', title: 'Out-of-Stock Products', desc: 'Products with zero or negative stock', icon: AlertTriangle, component: null, link: '/products?filter=out_of_stock' },
      { id: 'expiring_products', title: 'Expiring Products', desc: 'Review product expiry dates in the product register', icon: Clock, component: null, link: '/products?filter=expiring' },
      { id: 'stock_ledger', title: 'Stock Movement / Ledger', desc: 'History of stock additions, receipts and sales', icon: Activity, component: null, link: '/inventory-ledger' },
    ]
  },
  {
    title: '3. Purchases & Suppliers',
    description: 'Track purchase orders and supplier balances',
    reports: [
      { id: 'purchase_summary', title: 'Purchase Summary', desc: 'Review supplier purchase receipts', icon: Truck, component: null, link: '/purchases' },
      { id: 'outstanding_payables', title: 'Outstanding Payables', desc: 'Supplier contacts and purchasing records', icon: FileText, component: null, link: '/suppliers' },
      { id: 'supplier_balances', title: 'Supplier Directory', desc: 'Manage supplier contacts and records', icon: Building2, component: null, link: '/suppliers' },
    ]
  }
];

export const ReportsDashboard: React.FC = () => {
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Find the active report config
  let activeReportConfig = null;
  for (const cat of REPORT_CATEGORIES) {
    const found = cat.reports.find(r => r.id === activeReportId);
    if (found) {
      activeReportConfig = found;
      break;
    }
  }

  const renderHub = () => (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Advanced Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Select a report to view analytics, print, or export data.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {REPORT_CATEGORIES.map((category, idx) => (
          <div key={idx} className="space-y-4">
            <div className="pb-2 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{category.title}</h2>
              <p className="text-sm text-gray-500">{category.description}</p>
            </div>
            
            <div className="space-y-3">
              {category.reports.map(report => {
                const Icon = report.icon;
                return (
                  <Card 
                    key={report.id} 
                    className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                    onClick={() => {
                      if (report.link) {
                        window.location.href = report.link;
                      } else {
                        setActiveReportId(report.id);
                      }
                    }}
                  >
                    <CardContent className="p-4 flex gap-4 items-start">
                      <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mt-0.5">
                        <Icon size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{report.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">{report.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!activeReportId || !activeReportConfig) {
    return renderHub();
  }

  const ActiveComponent = activeReportConfig.component as React.ElementType;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={() => setActiveReportId(null)} className="p-2">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{activeReportConfig.title}</h1>
          <p className="text-sm text-gray-500">{activeReportConfig.desc}</p>
        </div>
      </div>

      {ActiveComponent ? (
        <ActiveComponent title={activeReportConfig.title} />
      ) : (
        <ComingSoon title={activeReportConfig.title} />
      )}
    </div>
  );
};
