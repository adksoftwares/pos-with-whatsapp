import { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarcodeScanner } from '../../components/scanner/BarcodeScanner';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit: any | null;
  onSuccess: () => void;
}

export const ProductFormModal = ({ isOpen, onClose, productToEdit, onSuccess }: ProductFormModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [categories, setCategories] = useState<{value: string, label: string}[]>([]);
  
  const isEdit = !!productToEdit;

  const [formData, setFormData] = useState({
    sku: '', // Code
    barcode: '',
    name: '',
    company: '',
    categoryId: '',
    unitSize: '',
    unit: 'piece',
    
    // Pricing
    mrpPrice: '',
    sellingPrice: '', // Sale Price
    discountReceived: '0',
    discountAllowed: '0',
    
    // Inventory
    stockQuantity: '',
    costPrice: '',
    expiryDate: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calculate Sale Price based on MRP - Discount Allowed
  useEffect(() => {
    if (formData.mrpPrice && formData.discountAllowed) {
      const mrp = parseFloat(formData.mrpPrice) || 0;
      const disc = parseFloat(formData.discountAllowed) || 0;
      const sale = mrp - (mrp * (disc / 100));
      if (!isNaN(sale)) {
        setFormData(prev => ({ ...prev, sellingPrice: sale.toFixed(2) }));
      }
    } else if (formData.mrpPrice) {
      setFormData(prev => ({ ...prev, sellingPrice: parseFloat(formData.mrpPrice).toFixed(2) }));
    }
  }, [formData.mrpPrice, formData.discountAllowed]);

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      
      if (productToEdit) {
        setFormData({
          sku: productToEdit.sku || '',
          barcode: productToEdit.barcode || '',
          name: productToEdit.name || '',
          company: productToEdit.company || '',
          categoryId: productToEdit.categoryId || '',
          unitSize: productToEdit.unitSize?.toString() || '',
          unit: productToEdit.unit || 'piece',
          mrpPrice: productToEdit.mrpPrice?.toString() || '',
          sellingPrice: productToEdit.sellingPrice?.toString() || '',
          discountReceived: productToEdit.discountReceived?.toString() || '0',
          discountAllowed: productToEdit.discountAllowed?.toString() || '0',
          stockQuantity: productToEdit.stockQuantity?.toString() || '',
          costPrice: productToEdit.costPrice?.toString() || '',
          expiryDate: productToEdit.expiryDate ? new Date(productToEdit.expiryDate).toISOString().split('T')[0] : '',
        });
      } else {
        setFormData({
          sku: '',
          barcode: '',
          name: '',
          company: '',
          categoryId: '',
          unitSize: '',
          unit: 'piece',
          mrpPrice: '',
          sellingPrice: '',
          discountReceived: '0',
          discountAllowed: '0',
          stockQuantity: '',
          costPrice: '',
          expiryDate: '',
        });
      }
      setErrors({});
    }
  }, [isOpen, productToEdit]);

  const loadCategories = async () => {
    try {
      const res = await apiClient.get('/categories');
      setCategories((res.data.data || res.data || []).map((c: any) => ({ value: c.id, label: c.name })));
    } catch (error) {
      // Ignore
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) {
      setErrors(prev => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const handleScan = (code: string) => {
    setFormData(prev => ({ ...prev, barcode: code }));
    if (errors.barcode) {
      setErrors(prev => ({ ...prev, barcode: '' }));
    }
    setIsScannerOpen(false);
    toast.success('Barcode scanned successfully');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const payload: any = {
      name: formData.name,
      sku: formData.sku || null,
      barcode: formData.barcode || null,
      company: formData.company || null,
      categoryId: formData.categoryId || null,
      unitSize: formData.unitSize ? parseFloat(formData.unitSize) : null,
      unit: formData.unit,
      mrpPrice: formData.mrpPrice ? parseFloat(formData.mrpPrice) : null,
      sellingPrice: parseFloat(formData.sellingPrice),
      discountReceived: parseFloat(formData.discountReceived) || 0,
      discountAllowed: parseFloat(formData.discountAllowed) || 0,
      costPrice: formData.costPrice ? parseFloat(formData.costPrice) : null,
      expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : null,
      stockQuantity: parseFloat(formData.stockQuantity) || 0,
    };

    try {
      if (isEdit) {
        await apiClient.patch(`/products/${productToEdit.id}`, payload);
        toast.success('Product updated successfully');
      } else {
        const res = await apiClient.post('/products', payload);
        toast.success(res.data?.message || 'Product created successfully');
      }
      onSuccess();
    } catch (error: any) {
      if (error.details && Array.isArray(error.details)) {
        const fieldErrors: Record<string, string> = {};
        error.details.forEach((err: any) => {
          const field = err.path.split('.').pop();
          if (field) fieldErrors[field] = err.message;
        });
        setErrors(fieldErrors);
      } else if (error.code === 'PLAN_LIMIT_REACHED' || error.response?.data?.error?.code === 'PLAN_LIMIT_REACHED') {
        toast.error('Product limit reached! Contact your administrator to upgrade to Pro.');
      } else {
        toast.error(error.message || 'Failed to save product');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isScannerOpen) {
    return <BarcodeScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} />;
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isEdit ? 'Edit Product' : 'Add Product / Receive Stock'} 
      maxWidth="2xl"
    >
      <p className="text-sm text-gray-500 mb-6">
        Scan a barcode or enter product details. If the code exists, stock will be increased.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 pb-2 h-[65vh] overflow-y-auto px-1">
        
        {/* Section 1 */}
        <div>
          <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wider mb-4 border-b pb-2">1. Product Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input 
              label="Code" 
              name="sku" 
              required
              value={formData.sku} 
              onChange={handleChange}
              error={errors.sku}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
              <div className="flex gap-2">
                <Input 
                  name="barcode" 
                  value={formData.barcode} 
                  onChange={handleChange}
                  error={errors.barcode}
                  className="flex-1"
                  placeholder="Scan or type"
                />
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3"
                  title="Scan Barcode"
                >
                  <ScanLine size={20} />
                </Button>
              </div>
              {errors.barcode && <p className="text-sm text-red-600 mt-1">{errors.barcode}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input 
              label="Product Name" 
              name="name" 
              required 
              value={formData.name} 
              onChange={handleChange}
              error={errors.name}
            />
            <Input 
              label="Company" 
              name="company" 
              value={formData.company} 
              onChange={handleChange}
              error={errors.company}
              placeholder="e.g., Manufacturer / Brand"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select 
              label="Category" 
              name="categoryId" 
              options={[{ value: '', label: 'Select Category' }, ...categories]} 
              value={formData.categoryId} 
              onChange={handleChange}
              error={errors.categoryId}
            />
            <Input 
              label="Unit Size" 
              name="unitSize" 
              type="number"
              step="0.01"
              value={formData.unitSize} 
              onChange={handleChange}
              error={errors.unitSize}
              placeholder="e.g., 50"
            />
            <Select 
              label="Unit Type" 
              name="unit" 
              options={[
                { value: 'piece', label: 'Piece' },
                { value: 'kg', label: 'Kg' },
                { value: 'g', label: 'Gram' },
                { value: 'liter', label: 'Liter' },
                { value: 'ml', label: 'Milliliter' },
                { value: 'pack', label: 'Pack' },
                { value: 'box', label: 'Box' },
              ]}
              value={formData.unit} 
              onChange={handleChange}
              error={errors.unit}
            />
          </div>
        </div>

        {/* Section 2 */}
        <div>
          <div className="flex justify-between items-end border-b pb-2 mb-4">
            <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wider">2. Pricing & Discounts</h3>
            <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">Automatic Calculations Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input 
              label="Price (Rs.)" 
              name="mrpPrice" 
              type="number" 
              step="0.01" 
              min="0"
              required 
              value={formData.mrpPrice} 
              onChange={handleChange}
              error={errors.mrpPrice}
            />
            <Input 
              label="Sale Price (Rs.)" 
              name="sellingPrice" 
              type="number" 
              step="0.01" 
              min="0"
              required 
              readOnly
              className="bg-gray-50 border-dashed"
              value={formData.sellingPrice} 
              onChange={handleChange}
              error={errors.sellingPrice}
              helperText="Auto-calculated: Price − Disc Allowed"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Discount Received (%)" 
              name="discountReceived" 
              type="number" 
              step="0.01" 
              min="0"
              max="100"
              value={formData.discountReceived} 
              onChange={handleChange}
              error={errors.discountReceived}
              helperText="Supplier purchase discount"
            />
            <Input 
              label="Discount Allowed (%)" 
              name="discountAllowed" 
              type="number" 
              step="0.01" 
              min="0"
              max="100"
              value={formData.discountAllowed} 
              onChange={handleChange}
              error={errors.discountAllowed}
              helperText="Customer sales discount limit"
            />
          </div>
        </div>

        {/* Section 3 */}
        <div>
          <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wider mb-4 border-b pb-2">3. Inventory & Expiry</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
              label={isEdit ? "Add to Current Stock" : "Stock to Add"} 
              name="stockQuantity" 
              type="number" 
              min="0" 
              value={formData.stockQuantity} 
              onChange={handleChange}
              error={errors.stockQuantity}
              helperText={isEdit ? "Leave 0 to keep current stock" : ""}
            />
            <Input 
              label="Cost Price (Rs.)" 
              name="costPrice" 
              type="number" 
              step="0.01" 
              min="0"
              value={formData.costPrice} 
              onChange={handleChange}
              error={errors.costPrice}
              helperText="Optional"
            />
            <Input 
              label="Expiry Date" 
              name="expiryDate" 
              type="date"
              value={formData.expiryDate} 
              onChange={handleChange}
              error={errors.expiryDate}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6 sticky bottom-0 bg-white pb-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {isEdit ? 'Save Changes' : 'Save Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
