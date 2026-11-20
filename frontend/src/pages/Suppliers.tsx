import React, { useEffect, useState } from 'react';
import { Plus, Truck, Pencil, Trash2, Phone, Mail, MapPin, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';

interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

const blankForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: ''
};

export const Suppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState(blankForm);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/suppliers');
      setSuppliers(res.data || []);
    } catch {
      toast.error('Could not load suppliers directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        notes: supplier.notes || ''
      });
    } else {
      setEditingSupplier(null);
      setFormData(blankForm);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await apiClient.patch(`/suppliers/${editingSupplier.id}`, formData);
        toast.success('Supplier updated successfully');
      } else {
        await apiClient.post('/suppliers', formData);
        toast.success('Supplier added successfully');
      }
      setIsModalOpen(false);
      loadSuppliers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save supplier');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete supplier "${name}"? If they have linked purchase orders, they cannot be deleted.`)) return;
    try {
      await apiClient.delete(`/suppliers/${id}`);
      toast.success('Supplier deleted');
      loadSuppliers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete supplier');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Suppliers Directory</h1>
          <p className="text-sm text-slate-500 mt-1">Manage distributors, wholesale vendors, and procurement contacts</p>
        </div>
        <Button 
          onClick={() => handleOpenModal()} 
          className="bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-2"
        >
          <Plus size={16} /> Add Supplier
        </Button>
      </div>

      {/* Directory Grid */}
      {isLoading ? (
        <LoadingState />
      ) : suppliers.length === 0 ? (
        <EmptyState 
          icon={Truck} 
          title="No suppliers listed" 
          description="Add your product suppliers, FMCG distributors, and wholesale contacts here." 
          actionLabel="Add Supplier" 
          onAction={() => handleOpenModal()} 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <Card key={s.id} className="border-slate-200/80 hover:border-slate-300 hover:shadow-md transition-all rounded-2xl bg-white flex flex-col justify-between">
              <CardContent className="p-5">
                
                {/* Header & Controls */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                      <Truck size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">{s.name}</h3>
                      <p className="text-[11px] text-slate-400 font-medium">Wholesale Distributor</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={() => handleOpenModal(s)} 
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Supplier"
                    >
                      <Pencil size={15} />
                    </button>
                    <button 
                      onClick={() => handleDelete(s.id, s.name)} 
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Supplier"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 py-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-slate-400 shrink-0" />
                    <span>{s.phone ? <a href={`tel:${s.phone}`} className="hover:text-blue-600 font-medium">{s.phone}</a> : <span className="text-slate-400 italic">No phone</span>}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{s.email ? <a href={`mailto:${s.email}`} className="hover:text-blue-600">{s.email}</a> : <span className="text-slate-400 italic">No email</span>}</span>
                  </div>
                  {s.address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{s.address}</span>
                    </div>
                  )}
                  {s.notes && (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-50 text-[11px] text-slate-600 border border-slate-100 flex items-start gap-1.5">
                      <FileText size={13} className="text-slate-400 shrink-0 mt-0.5" />
                      <span>{s.notes}</span>
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingSupplier ? "Edit Supplier Record" : "Add Supplier / Distributor"}
      >
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <Input 
            required 
            label="Supplier / Company Name *" 
            value={formData.name} 
            onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
            placeholder="e.g. Ceylon Agro Distributions Ltd"
          />
          <Input 
            label="Phone Number" 
            value={formData.phone} 
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
            placeholder="e.g. 011 234 5678"
          />
          <Input 
            type="email" 
            label="Email Address" 
            value={formData.email} 
            onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
            placeholder="e.g. orders@supplier.lk"
          />
          <Input 
            label="Warehouse / Office Address" 
            value={formData.address} 
            onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
            placeholder="e.g. Industrial Zone, Colombo"
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person & Notes</label>
            <textarea 
              className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
              value={formData.notes} 
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
              placeholder="e.g. Sales Rep: Rohan (077...), Delivery days: Tuesday & Friday" 
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
