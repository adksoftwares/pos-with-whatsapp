import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../../components/ui/Card';
import { DollarSign, ShoppingCart, Package, TrendingUp } from 'lucide-react';
import { apiClient } from '../../../api/client';
import toast from 'react-hot-toast';
import { formatLKR } from '../../../utils/currency';
import { type DateRange, getPresets, DateRangeSelector } from './DateRangeSelector';

export const SalesSummaryReport: React.FC = () => {
  const presets = getPresets();
  const [activePreset, setActivePreset] = useState<DateRange>(presets[0]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadReport();
  }, [activePreset]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const params = { from: activePreset.from, to: activePreset.to };
      const res = await apiClient.get('/reports/sales-summary', { params });
      setSummary((res.data?.id || Array.isArray(res.data) || Object.keys(res.data).length > 0) ? res.data : (res.data || res));
    } catch (error: any) {
      toast.error('Failed to load sales summary.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DateRangeSelector presets={presets} activePreset={activePreset} onChange={setActivePreset} />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : !summary ? (
        <div className="text-center p-12 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">No data available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 text-green-700 rounded-lg"><DollarSign size={20} /></div>
                <p className="text-sm font-medium text-gray-500">Net Sales</p>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{formatLKR(summary.netSales)}</h3>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><ShoppingCart size={20} /></div>
                <p className="text-sm font-medium text-gray-500">Completed Orders</p>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{summary.orderCount}</h3>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg"><Package size={20} /></div>
                <p className="text-sm font-medium text-gray-500">Items Sold</p>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{summary.itemsSold}</h3>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-100 text-orange-700 rounded-lg"><TrendingUp size={20} /></div>
                <p className="text-sm font-medium text-gray-500">Avg. Order Value</p>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{formatLKR(summary.averageOrderValue)}</h3>
            </CardContent>
          </Card>

          <Card className="sm:col-span-2 lg:col-span-4">
            <CardContent className="p-6">
              <h4 className="text-lg font-semibold mb-4">Discounts & Deductions</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Total Discounts Applied</span>
                  <span className="font-medium text-red-600">-{formatLKR(summary.discountTotal)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">Tax Collected</span>
                  <span className="font-medium text-gray-900">{formatLKR(summary.taxTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
