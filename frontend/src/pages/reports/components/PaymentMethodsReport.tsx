import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { apiClient } from '../../../api/client';
import toast from 'react-hot-toast';
import { formatLKR } from '../../../utils/currency';
import { type DateRange, getPresets, DateRangeSelector } from './DateRangeSelector';

export const PaymentMethodsReport: React.FC = () => {
  const presets = getPresets();
  const [activePreset, setActivePreset] = useState<DateRange>(presets[0]);
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadReport();
  }, [activePreset]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const params = { from: activePreset.from, to: activePreset.to };
      const res = await apiClient.get('/reports/payment-methods', { params });
      setPayments((res.data?.id || Array.isArray(res.data) || Object.keys(res.data).length > 0) ? res.data : (res.data || res));
    } catch (error: any) {
      toast.error('Failed to load payment methods.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DateRangeSelector presets={presets} activePreset={activePreset} onChange={setActivePreset} />
      </div>

      <Card>
        <CardHeader className="pb-2 border-b border-gray-100">
          <CardTitle className="text-lg">Payment Methods Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {payments.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">No payments recorded.</div>
              ) : payments.map(pay => (
                <div key={pay.method} className="flex justify-between items-center p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <Badge variant="neutral" className="text-sm px-3 py-1">{pay.method}</Badge>
                    <span className="text-sm text-gray-500">{pay.count} transactions</span>
                  </div>
                  <span className="text-xl font-bold text-gray-900">{formatLKR(pay.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
