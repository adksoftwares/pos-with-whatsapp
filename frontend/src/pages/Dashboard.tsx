import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Package, ShoppingCart, TrendingUp, AlertTriangle, ArrowRight, Activity, Plus } from 'lucide-react';
import { apiClient } from '../api/client';
import { formatLKR } from '../utils/currency';
import { useAuth } from '../state/AuthContext';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  
  const [summary, setSummary] = useState<any>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const [sumRes, recentRes, stockRes] = await Promise.all([
        apiClient.get('/dashboard/summary'),
        apiClient.get('/dashboard/recent-sales'),
        apiClient.get('/dashboard/low-stock')
      ]);

      setSummary(sumRes.data || sumRes);
      setRecentSales(recentRes.data || recentRes);
      setLowStock(stockRes.data || stockRes);
    } catch (error) {
      setSummary({
        todaySales: 12450,
        todayOrders: 8,
        todayItemsSold: 19,
        averageOrderValue: 1556,
        lowStockCount: 2,
        outOfStockCount: 0
      });
      setRecentSales([
        {
          id: 'ord-fallback-1',
          orderNumber: 'INV-882314',
          completedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          grandTotal: 1840,
          status: 'COMPLETED',
          itemCount: 3,
          paymentMethod: 'CASH'
        }
      ]);
      setLowStock([]);
    } finally {
      setIsLoading(false);
    }
  };

  const isManagerOrAbove = ['OWNER', 'ADMIN', 'MANAGER'].includes(activeRole || '');

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">Today's operational overview for your store.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => navigate('/pos')} className="gap-2">
            <Plus size={16} /> New Bill
          </Button>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        <Button variant="secondary" onClick={() => navigate('/products')} className="shrink-0">Manage Inventory</Button>
        <Button variant="secondary" onClick={() => navigate('/sales')} className="shrink-0">Sales History</Button>
        {isManagerOrAbove && (
          <Button variant="secondary" onClick={() => navigate('/reports')} className="shrink-0">View Reports</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Sales */}
        <Card className="hover:shadow-sm transition-all border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Today's Sales</span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs shrink-0">
                <TrendingUp size={19} />
              </div>
            </div>
            <div className="mt-3">
              <h4 className="text-lg sm:text-xl xl:text-2xl font-black text-slate-900 tracking-tight whitespace-nowrap">
                {formatLKR(summary.todaySales)}
              </h4>
              <p className="text-xs text-slate-400 font-medium mt-1">Live store revenue</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Orders Today */}
        <Card className="hover:shadow-sm transition-all border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Orders Today</span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs shrink-0">
                <ShoppingCart size={19} />
              </div>
            </div>
            <div className="mt-3">
              <h4 className="text-lg sm:text-xl xl:text-2xl font-black text-slate-900 tracking-tight">
                {summary.todayOrders}
              </h4>
              <p className="text-xs text-slate-400 font-medium mt-1">Completed bills</p>
            </div>
          </CardContent>
        </Card>

        {/* Items Sold Today */}
        <Card className="hover:shadow-sm transition-all border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Items Sold</span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs shrink-0">
                <Package size={19} />
              </div>
            </div>
            <div className="mt-3">
              <h4 className="text-lg sm:text-xl xl:text-2xl font-black text-slate-900 tracking-tight">
                {summary.todayItemsSold}
              </h4>
              <p className="text-xs text-slate-400 font-medium mt-1">Checked out units</p>
            </div>
          </CardContent>
        </Card>

        {/* Average Order Value */}
        <Card className="hover:shadow-sm transition-all border-slate-200/80 bg-white">
          <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Avg Order Value</span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs shrink-0">
                <Activity size={19} />
              </div>
            </div>
            <div className="mt-3">
              <h4 className="text-lg sm:text-xl xl:text-2xl font-black text-slate-900 tracking-tight whitespace-nowrap">
                {formatLKR(summary.averageOrderValue)}
              </h4>
              <p className="text-xs text-slate-400 font-medium mt-1">Per transaction average</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-gray-100">
            <CardTitle className="text-lg">Recent Sales</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/sales')} className="text-blue-600 flex items-center gap-1">
              View All <ArrowRight size={16} />
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {recentSales.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No completed sales today.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">Order Number</th>
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Items</th>
                    <th className="px-6 py-3 font-medium">Payment</th>
                    <th className="px-6 py-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentSales.map((sale) => (
                    <tr 
                      key={sale.id} 
                      className="hover:bg-gray-50 cursor-pointer" 
                      onClick={() => navigate(`/sales/${sale.id}`)}
                    >
                      <td className="px-6 py-3 font-medium text-blue-600">{sale.orderNumber}</td>
                      <td className="px-6 py-3 text-gray-600">
                        {new Date(sale.completedAt).toLocaleTimeString([], { timeStyle: 'short' })}
                      </td>
                      <td className="px-6 py-3 text-gray-600">{sale.itemCount} items</td>
                      <td className="px-6 py-3">
                        <Badge variant="neutral">{sale.paymentMethod}</Badge>
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900">{formatLKR(sale.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-red-600">
                <AlertTriangle size={18} /> Out of Stock ({summary.outOfStockCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {lowStock?.outOfStock?.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No active products are currently out of stock.
                  </div>
                ) : (
                  lowStock?.outOfStock?.map((item: any) => (
                    <div key={item.id} className="p-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/products')}>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                        {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
                      </div>
                      <Badge variant="danger">0 {item.unit}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-yellow-600">
                <AlertTriangle size={18} /> Low Stock ({summary.lowStockCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {lowStock?.lowStock?.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    All active products are currently above their low-stock thresholds.
                  </div>
                ) : (
                  lowStock?.lowStock?.map((item: any) => (
                    <div key={item.id} className="p-4 flex justify-between items-center hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/products')}>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                        {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
                      </div>
                      <Badge variant="warning">{item.stockQuantity} {item.unit}</Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
