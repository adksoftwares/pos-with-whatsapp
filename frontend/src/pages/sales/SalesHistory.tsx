import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Search, Filter, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '../../api/client';
import toast from 'react-hot-toast';
import { formatLKR } from '../../utils/currency';
import { db } from '../../db/offlineDb';

interface Sale {
  id: string;
  orderNumber: string;
  createdAt: string;
  grandTotal: number;
  status: string;
  paymentStatus: string;
  cashier: { name: string };
  payments: { method: string, amount: number }[];
}

export const SalesHistory: React.FC = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadSales();
  }, [page, debouncedSearch]);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      let serverSales: any[] = [];
      let total = 1;
      
      if (navigator.onLine) {
        try {
          const res = await apiClient.get('/orders', {
            params: {
              page,
              pageSize: 20,
              search: debouncedSearch || undefined
            }
          });
          serverSales = res.data?.data || [];
          total = res.data?.pagination?.totalPages || 1;
        } catch(e) {}
      }

      // Add local offline sales that are pending or conflict
      let localSales: any[] = [];
      if (page === 1 && !debouncedSearch) {
        const local = await db.localOrders
          .where('status').anyOf(['PENDING_SYNC', 'CONFLICT'])
          .reverse()
          .toArray();
          
        localSales = local.map(l => ({
          id: l.clientTransactionId,
          orderNumber: l.tempOrderNumber,
          createdAt: l.completedAt,
          grandTotal: l.grandTotal,
          status: l.status,
          _count: { items: l.snapshot?.items?.length || 0 },
          payments: l.snapshot?.payments || []
        }));
      }

      setSales([...localSales, ...serverSales]);
      setTotalPages(total);
    } catch (error) {
      toast.error('Failed to load sales history');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'PENDING_SYNC': return 'warning';
      case 'CONFLICT': return 'danger';
      case 'CANCELLED': return 'danger';
      default: return 'warning';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-4 md:-m-6">
      <div className="bg-white px-4 md:px-6 py-4 border-b border-gray-200 shrink-0">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Sales History</h1>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by order number (e.g. INV-2026...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
            />
          </div>
          <Button variant="secondary" className="gap-2 sm:w-auto w-full">
            <Filter size={18} />
            Filters
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center bg-white p-12 rounded-lg border border-dashed border-gray-300">
            <h3 className="text-lg font-medium text-gray-900">No sales found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order Number</th>
                    <th className="px-4 py-3 font-medium">Date & Time</th>
                    <th className="px-4 py-3 font-medium">Cashier</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-center">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-blue-600 cursor-pointer" onClick={() => navigate(`/sales/${sale.id}`)}>
                        {sale.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(sale.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{sale.cashier.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex flex-col gap-1">
                          {sale.payments.map((p, i) => (
                            <span key={i} className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                              {p.method}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatLKR(sale.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant={getStatusColor(sale.status)}>{sale.status}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/sales/${sale.id}`)}>
                          <Eye size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
