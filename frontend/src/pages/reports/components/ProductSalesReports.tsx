import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Download } from 'lucide-react';
import { apiClient } from '../../../api/client';
import toast from 'react-hot-toast';
import { formatLKR } from '../../../utils/currency';
import { type DateRange, getPresets, DateRangeSelector } from './DateRangeSelector';

export const ProductSalesReports: React.FC = () => {
  const presets = getPresets();
  const [activePreset, setActivePreset] = useState<DateRange>(presets[0]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadReport();
  }, [activePreset]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const params = { from: activePreset.from, to: activePreset.to, sort: 'revenue_desc' };
      const res = await apiClient.get('/reports/products', { params });
      setProducts((res.data?.id || Array.isArray(res.data) || Object.keys(res.data).length > 0) ? res.data : (res.data || res));
    } catch (error: any) {
      toast.error('Failed to load product sales.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!products || products.length === 0) {
      toast.error('No data to export.');
      return;
    }

    const headers = ['SKU', 'Product Name', 'Quantity Sold', 'Revenue', 'Orders'];
    const rows = products.map(p => [
      p.sku || '',
      `"${p.productName}"`,
      p.quantitySold,
      p.revenue,
      p.orderCount
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `product_sales_${activePreset.label.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DateRangeSelector presets={presets} activePreset={activePreset} onChange={setActivePreset} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-100">
          <CardTitle className="text-lg">Product Performance</CardTitle>
          <Button variant="secondary" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download size={16} /> Export CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Product</th>
                  <th className="px-6 py-3 font-medium text-right">Qty Sold</th>
                  <th className="px-6 py-3 font-medium text-right">Orders</th>
                  <th className="px-6 py-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No sales data for this period.
                    </td>
                  </tr>
                ) : products.map((prod) => (
                  <tr key={prod.productId} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <div className="font-medium text-gray-900">{prod.productName}</div>
                      {prod.sku && <div className="text-xs text-gray-500 mt-0.5">SKU: {prod.sku}</div>}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900">{prod.quantitySold}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{prod.orderCount}</td>
                    <td className="px-6 py-3 text-right font-medium text-blue-600">{formatLKR(prod.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
