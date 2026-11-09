import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { apiClient } from '../../api/client';
import toast from 'react-hot-toast';
import { Printer, Wifi, Bluetooth, Usb, Monitor } from 'lucide-react';

interface PrinterProfile {
  id: string;
  name: string;
  paperWidth: '58mm' | '80mm';
  connectionType: 'BROWSER' | 'BLUETOOTH' | 'USB' | 'NETWORK';
  isDefault: boolean;
  enabled: boolean;
}

export const PrintersSettings: React.FC = () => {
  const [printers, setPrinters] = useState<PrinterProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [connectionType, setConnectionType] = useState<'BROWSER' | 'BLUETOOTH' | 'USB' | 'NETWORK'>('BROWSER');
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    try {
      const res = await apiClient.get('/printers');
      setPrinters((res.data?.id || Array.isArray(res.data) || Object.keys(res.data).length > 0) ? res.data : (res.data || res));
    } catch (error) {
      toast.error('Failed to load printers.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await apiClient.post('/printers', {
        name,
        paperWidth,
        connectionType,
        isDefault,
        enabled: true
      });
      toast.success('Printer added successfully');
      setIsAdding(false);
      resetForm();
      loadPrinters();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add printer.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this printer?')) return;
    try {
      await apiClient.delete(`/printers/${id}`);
      toast.success('Printer removed');
      loadPrinters();
    } catch (error) {
      toast.error('Failed to remove printer.');
    }
  };

  const resetForm = () => {
    setName('');
    setPaperWidth('58mm');
    setConnectionType('BROWSER');
    setIsDefault(false);
  };

  const handleTestPrint = async (printer: PrinterProfile) => {
    try {
      if (printer.connectionType !== 'BROWSER') {
        toast.error('Hardware test unavailable in this environment.');
        return;
      }
      
      // In a real scenario, we'd render a test receipt. 
      // We trigger PrintService to adhere strictly to the adapter architecture.
      const { PrintService } = await import('../../services/printService');
      await PrintService.printReceipt(printer, null);
      
      toast.success('Test print initiated.');
    } catch (err: any) {
      toast.error(err.message || 'Print failed');
    }
  };

  if (isLoading) return <div>Loading printers...</div>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Printer Configuration</h1>
          <p className="text-gray-500">Manage thermal printer profiles for your business.</p>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} className="gap-2">
            <Printer size={18} />
            Add Printer
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">New Printer Profile</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input 
              label="Printer Name" 
              placeholder="e.g. Front Desk Thermal" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paper Width</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={paperWidth}
                onChange={(e) => setPaperWidth(e.target.value as '58mm' | '80mm')}
              >
                <option value="58mm">58mm (Small)</option>
                <option value="80mm">80mm (Large)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Connection Type</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={connectionType}
                onChange={(e) => setConnectionType(e.target.value as any)}
              >
                <option value="BROWSER">Browser (System Printer)</option>
                <option value="BLUETOOTH">Bluetooth (Direct ESC/POS)</option>
                <option value="USB">USB (Direct ESC/POS)</option>
                <option value="NETWORK">LAN / WiFi (Direct ESC/POS)</option>
              </select>
            </div>
            
            <div className="flex items-center mt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Set as Default Printer</span>
              </label>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="ghost" onClick={() => { setIsAdding(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} isLoading={isSaving} disabled={!name.trim()}>Save Profile</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {printers.map(printer => (
          <div key={printer.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex flex-col relative">
            {printer.isDefault && (
              <span className="absolute top-0 right-0 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
                DEFAULT
              </span>
            )}
            
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 bg-gray-50 rounded-lg text-gray-500">
                {printer.connectionType === 'BROWSER' && <Monitor size={24} />}
                {printer.connectionType === 'BLUETOOTH' && <Bluetooth size={24} />}
                {printer.connectionType === 'USB' && <Usb size={24} />}
                {printer.connectionType === 'NETWORK' && <Wifi size={24} />}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 leading-tight">{printer.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{printer.paperWidth} • {printer.connectionType}</p>
              </div>
            </div>
            
            {printer.connectionType !== 'BROWSER' && (
              <div className="bg-orange-50 text-orange-700 text-xs p-2 rounded mb-4">
                This connection type is unsupported in the current web browser. Use the native application for direct hardware access.
              </div>
            )}
            
            <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleTestPrint(printer)}>
                Test Print
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(printer.id)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
        
        {printers.length === 0 && !isAdding && (
          <div className="col-span-full bg-gray-50 p-8 rounded-lg border border-dashed border-gray-300 text-center text-gray-500">
            <Printer size={48} className="mx-auto text-gray-300 mb-3" />
            <p>No printers configured.</p>
            <p className="text-sm mt-1">Configure a printer to generate and print receipts.</p>
          </div>
        )}
      </div>
    </div>
  );
};
