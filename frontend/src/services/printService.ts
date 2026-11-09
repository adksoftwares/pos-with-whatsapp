export interface PrinterProfile {
  id: string;
  name: string;
  paperWidth: '58mm' | '80mm';
  connectionType: 'BROWSER' | 'BLUETOOTH' | 'USB' | 'NETWORK';
  isDefault: boolean;
}

export interface PrintAdapter {
  connect(profile: PrinterProfile): Promise<void>;
  disconnect(): Promise<void>;
  print(data: any, profile: PrinterProfile): Promise<void>;
  isConnected(): boolean;
  getStatus(): 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'PRINTING' | 'COMPLETED' | 'ERROR' | 'UNSUPPORTED';
}

export class BrowserPrinterAdapter implements PrintAdapter {
  async connect() {
    return Promise.resolve();
  }
  async disconnect() {
    return Promise.resolve();
  }
  async print() {
    // Browser print triggers native window.print() inside the React component via DOM.
    // This adapter acts as a shim for structural compliance.
    window.print();
    return Promise.resolve();
  }
  isConnected() { return true; }
  getStatus(): 'CONNECTED' { return 'CONNECTED'; }
}

// In the future: class BluetoothEscPosAdapter implements PrintAdapter { ... }
// For now, we only implement the architecture. 

export class PrintService {
  static getAdapter(profile: PrinterProfile | null): PrintAdapter {
    if (!profile) return new BrowserPrinterAdapter();
    
    switch (profile.connectionType) {
      case 'BROWSER':
        return new BrowserPrinterAdapter();
      case 'BLUETOOTH':
      case 'USB':
      case 'NETWORK':
        // Not implemented yet. Fallback to a stub or throw an explicit unsupported error.
        throw new Error(`Direct ${profile.connectionType} printing is currently unsupported in this environment.`);
      default:
        return new BrowserPrinterAdapter();
    }
  }

  static async printReceipt(profile: PrinterProfile | null, receiptData: any) {
    try {
      const adapter = this.getAdapter(profile);
      await adapter.connect(profile as PrinterProfile); // Non-null assertion is safe if adapter handles null
      await adapter.print(receiptData, profile as PrinterProfile);
      // We don't automatically disconnect browser adapter, but we might for Bluetooth.
      // await adapter.disconnect();
    } catch (error) {
      throw error;
    }
  }
}
