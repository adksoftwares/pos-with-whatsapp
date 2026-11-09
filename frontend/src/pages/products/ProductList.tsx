import { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { formatLKR } from '../../utils/currency';
import { apiClient } from '../../api/client';
import { Plus, Search, Edit, Power, PowerOff, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { ProductFormModal } from './ProductFormModal';
import { Modal } from '../../components/ui/Modal';
import { ArrowLeftRight } from 'lucide-react';
import { useSubscription } from '../../state/SubscriptionContext';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  status: 'ACTIVE' | 'INACTIVE';
  category?: { name: string };
}

export const ProductList = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState(new URLSearchParams(window.location.search).get('filter') === 'expiring' ? 'EXPIRING' : '');
  const [stockValue, setStockValue] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState('');
  const [stockReason, setStockReason] = useState('Stock count correction');
  const { subscription, refresh: refreshSub } = useSubscription();

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/products', {
        params: { page, limit: 10, search, status: statusFilter || undefined, expiryStatus: expiryFilter || undefined }
      });
      setProducts(res.data.products);
      setTotalPages(res.data.pagination.totalPages);
    } catch (error: any) {
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { apiClient.get('/products/stock-value').then((r:any)=>setStockValue(r.data)).catch(()=>{}); }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, expiryFilter]);

  useEffect(() => {
    fetchProducts();
  }, [page]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiClient.patch(`/products/${id}/status`, { status: newStatus });
      toast.success(`Product marked as ${newStatus}`);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const handleAdd = () => {
    setSelectedProduct(null);
    setIsFormOpen(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsFormOpen(true);
  };

  const saveStockAdjustment = async (e: React.FormEvent) => { e.preventDefault(); if(!stockProduct) return; try { await apiClient.post(`/products/${stockProduct.id}/adjust-stock`, { quantity:Number(stockDelta), reason:stockReason }); toast.success('Stock adjusted'); setStockProduct(null); setStockDelta(''); fetchProducts(); } catch(error:any) { toast.error(error.message||'Stock adjustment failed'); } };

  const onSaveSuccess = () => {
    setIsFormOpen(false);
    fetchProducts();
    refreshSub();
  };

  return (
    <div className="space-y-6">
      {stockValue && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Card><CardContent className="p-4"><p className="text-xs text-gray-500">Stock units</p><b>{Number(stockValue.units).toLocaleString("en-LK")}</b></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-gray-500">Stock cost value</p><b>{formatLKR(stockValue.costValue)}</b></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-gray-500">Retail value</p><b>{formatLKR(stockValue.retailValue)}</b></CardContent></Card></div>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Products</h2>
          <p className="text-gray-500 text-sm mt-1">Manage your inventory, prices, and stock.</p>
        </div>
        <div className="flex items-center gap-3"><select value={expiryFilter} onChange={e=>setExpiryFilter(e.target.value)} className="border rounded-md px-3 py-2 text-sm"><option value="">All expiry dates</option><option value="EXPIRING">Expiring in 30 days</option><option value="EXPIRED">Expired</option></select>
          {subscription && (
            <div className="flex items-center gap-2 text-sm">
              <span className={`font-medium ${
                subscription.productCount >= subscription.productLimit ? 'text-red-600' : 'text-gray-600'
              }`}>
                {subscription.productCount} / {subscription.productLimit} products
              </span>
              {subscription.productCount >= subscription.productLimit && (
                <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  Limit reached
                </span>
              )}
            </div>
          )}
          <Button onClick={handleAdd} leftIcon={<Plus size={16} />}>
            Add Product
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 items-center bg-gray-50/50 rounded-t-lg">
            <div className="w-full sm:w-96 relative">
              <Input 
                placeholder="Search name, SKU, barcode..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={16} />}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select 
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'ACTIVE', label: 'Active Only' },
                  { value: 'INACTIVE', label: 'Inactive Only' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <LoadingState />
          ) : products.length === 0 ? (
            <EmptyState 
              icon={Package} 
              title="No products found" 
              description={search ? "Try adjusting your search or filters." : "Get started by adding your first product."}
              actionLabel={search ? undefined : "Add Product"}
              onAction={handleAdd}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU / Barcode</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const isLowStock = product.stockQuantity <= product.lowStockThreshold;
                    const isOutOfStock = product.stockQuantity <= 0;
                    
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.category?.name || 'Uncategorized'}</p>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {product.sku && <span className="text-gray-900">SKU: {product.sku}</span>}
                            {product.sku && product.barcode && <br/>}
                            {product.barcode && <span className="text-gray-500">BC: {product.barcode}</span>}
                            {!product.sku && !product.barcode && <span className="text-gray-400">-</span>}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-gray-900">
                          {formatLKR(product.sellingPrice)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={isOutOfStock ? 'danger' : isLowStock ? 'warning' : 'success'}
                          >
                            {Number(product.stockQuantity)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.status === 'ACTIVE' ? 'success' : 'neutral'}>
                            {product.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => {setStockProduct(product);setStockDelta('');}} className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Adjust stock"><ArrowLeftRight size={16}/></button>
                            <button 
                              onClick={() => handleEdit(product)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => toggleStatus(product.id, product.status)}
                              className={`p-1.5 rounded transition-colors ${
                                product.status === 'ACTIVE' 
                                  ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' 
                                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                              }`}
                              title={product.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                            >
                              {product.status === 'ACTIVE' ? <PowerOff size={16} /> : <Power size={16} />}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white rounded-b-lg">
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={!!stockProduct} onClose={()=>setStockProduct(null)} title={`Adjust stock · ${stockProduct?.name||''}`}><form onSubmit={saveStockAdjustment} className="space-y-3"><p className="text-sm text-gray-500">Current stock: {Number(stockProduct?.stockQuantity||0)}</p><Input required type="number" step="0.001" value={stockDelta} onChange={e=>setStockDelta(e.target.value)} placeholder="Quantity (+ add / − remove)"/><Input required value={stockReason} onChange={e=>setStockReason(e.target.value)} placeholder="Reason"/><p className="text-xs text-gray-500">Positive adds stock; negative removes stock. An inventory ledger entry is created.</p><div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={()=>setStockProduct(null)}>Cancel</Button><Button type="submit">Save adjustment</Button></div></form></Modal>
      {isFormOpen && <ProductFormModal isOpen={isFormOpen} onClose={()=>setIsFormOpen(false)} productToEdit={selectedProduct} onSuccess={onSaveSuccess}/>}
    </div>
  );
};
