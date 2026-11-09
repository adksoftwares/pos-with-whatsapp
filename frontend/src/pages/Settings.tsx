import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { useAuth } from '../state/AuthContext';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';

export const Settings = () => {
  const { activeBusiness } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Business profile form
  const [businessForm, setBusinessForm] = useState({
    name: '',
    businessType: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: 'Sri Lanka',
    currency: 'LKR',
    timezone: 'Asia/Colombo'
  });

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    receiptPaperWidth: '58mm',
    receiptShowLogo: true,
    receiptShowPhone: true,
    receiptShowEmail: false,
    receiptShowAddress: true,
    receiptShowCustomer: true,
    receiptShowSku: false,
    receiptFooterMessage: '',
    receiptThankYouMessage: 'Thank you for your purchase!',
    posAutoPrint: true,
    whatsappEnabled: true,
    whatsappMessageTemplate: 'Hello {business_name} customer, your bill for {date} is {total}. Thank you!'
  });

  useEffect(() => {
    if (!activeBusiness) return;
    const fetchSettings = async () => {
      try {
        setIsFetching(true);
        const res = await apiClient.get('/settings');
        const s = res.data;
        const b = s.business;

        setBusinessForm({
          name: b.name || '',
          businessType: b.businessType || '',
          phone: b.phone || '',
          email: b.email || '',
          address: b.address || '',
          city: b.city || '',
          country: b.country || 'Sri Lanka',
          currency: b.currency || 'LKR',
          timezone: b.timezone || 'Asia/Colombo'
        });

        setSettingsForm({
          receiptPaperWidth: s.receiptPaperWidth || '58mm',
          receiptShowLogo: s.receiptShowLogo ?? true,
          receiptShowPhone: s.receiptShowPhone ?? true,
          receiptShowEmail: s.receiptShowEmail ?? false,
          receiptShowAddress: s.receiptShowAddress ?? true,
          receiptShowCustomer: s.receiptShowCustomer ?? true,
          receiptShowSku: s.receiptShowSku ?? false,
          receiptFooterMessage: s.receiptFooterMessage || '',
          receiptThankYouMessage: s.receiptThankYouMessage || 'Thank you for your purchase!',
          posAutoPrint: s.posAutoPrint ?? true,
          whatsappEnabled: s.whatsappEnabled ?? true,
          whatsappMessageTemplate: s.whatsappMessageTemplate || 'Hello {business_name} customer, your bill for {date} is {total}. Thank you!'
        });
      } catch (error) {
        toast.error('Failed to load settings');
      } finally {
        setIsFetching(false);
      }
    };
    fetchSettings();
  }, [activeBusiness]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await apiClient.patch('/settings', {
        ...settingsForm,
        businessProfile: businessForm
      });
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return <div className="p-8 text-center text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h2>
        <p className="text-gray-500 text-sm mt-1">Manage your business and operational preferences.</p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Business Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Business Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Business Name" value={businessForm.name} onChange={e => setBusinessForm({...businessForm, name: e.target.value})} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Phone Number" value={businessForm.phone} onChange={e => setBusinessForm({...businessForm, phone: e.target.value})} />
              <Input label="Email Address" type="email" value={businessForm.email} onChange={e => setBusinessForm({...businessForm, email: e.target.value})} />
            </div>
            <Input label="Address" value={businessForm.address} onChange={e => setBusinessForm({...businessForm, address: e.target.value})} />
            <Input label="City" value={businessForm.city} onChange={e => setBusinessForm({...businessForm, city: e.target.value})} />
            <Select 
              label="Currency" 
              options={[{ value: 'LKR', label: 'Sri Lankan Rupee (LKR)' }]}
              value={businessForm.currency}
              onChange={e => setBusinessForm({...businessForm, currency: e.target.value})}
            />
            <Select 
              label="Timezone" 
              options={[{ value: 'Asia/Colombo', label: 'Asia/Colombo' }]}
              value={businessForm.timezone}
              onChange={e => setBusinessForm({...businessForm, timezone: e.target.value})}
            />
          </CardContent>
        </Card>

        {/* Receipt Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Receipt & Printer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select 
              label="Default Paper Width" 
              options={[
                { value: '58mm', label: '58mm Thermal' },
                { value: '80mm', label: '80mm Thermal' }
              ]}
              value={settingsForm.receiptPaperWidth}
              onChange={e => setSettingsForm({...settingsForm, receiptPaperWidth: e.target.value})}
            />
            
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={settingsForm.posAutoPrint} onChange={e => setSettingsForm({...settingsForm, posAutoPrint: e.target.checked})} className="rounded text-primary focus:ring-primary h-4 w-4" />
                <span>Auto-print receipt after sale</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={settingsForm.receiptShowPhone} onChange={e => setSettingsForm({...settingsForm, receiptShowPhone: e.target.checked})} className="rounded text-primary focus:ring-primary h-4 w-4" />
                <span>Show Business Phone</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={settingsForm.receiptShowAddress} onChange={e => setSettingsForm({...settingsForm, receiptShowAddress: e.target.checked})} className="rounded text-primary focus:ring-primary h-4 w-4" />
                <span>Show Business Address</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <input type="checkbox" checked={settingsForm.receiptShowCustomer} onChange={e => setSettingsForm({...settingsForm, receiptShowCustomer: e.target.checked})} className="rounded text-primary focus:ring-primary h-4 w-4" />
                <span>Show Customer Information</span>
              </label>
            </div>

            <Input 
              label="Thank You Message" 
              value={settingsForm.receiptThankYouMessage} 
              onChange={e => setSettingsForm({...settingsForm, receiptThankYouMessage: e.target.value})} 
            />
            <Input 
              label="Custom Footer Notes" 
              value={settingsForm.receiptFooterMessage} 
              onChange={e => setSettingsForm({...settingsForm, receiptFooterMessage: e.target.value})} 
              placeholder="e.g. Goods once sold cannot be returned"
            />
            
            <div className="pt-2">
              <Button variant="secondary" type="button" onClick={() => window.location.href='/settings/printers'}>
                Manage Hardware Printers
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Settings */}
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Bill Sharing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center space-x-2 text-sm mb-4">
              <input type="checkbox" checked={settingsForm.whatsappEnabled} onChange={e => setSettingsForm({...settingsForm, whatsappEnabled: e.target.checked})} className="rounded text-primary focus:ring-primary h-4 w-4" />
              <span className="font-medium text-gray-900">Enable WhatsApp Sharing</span>
            </label>
            
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Message Template</label>
              <textarea 
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100 disabled:text-gray-500" 
                rows={4}
                value={settingsForm.whatsappMessageTemplate}
                onChange={e => setSettingsForm({...settingsForm, whatsappMessageTemplate: e.target.value})}
                disabled={!settingsForm.whatsappEnabled}
              />
              <p className="text-xs text-gray-500 mt-1">Available placeholders: {'{business_name}'}, {'{order_number}'}, {'{date}'}, {'{total}'}, {'{payment_method}'}</p>
            </div>
          </CardContent>
        </Card>
        
        <div className="col-span-1 lg:col-span-2 flex justify-end">
          <Button type="submit" isLoading={isLoading} className="w-full md:w-auto px-8">
            Save All Settings
          </Button>
        </div>

      </form>
    </div>
  );
};
