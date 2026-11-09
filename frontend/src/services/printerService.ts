// Printer Architecture Foundation

export interface ReceiptData {
  storeName: string;
  orderId: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  date: Date;
}

export interface PrinterAdapter {
  printReceipt(data: ReceiptData): Promise<boolean>;
  checkStatus(): Promise<boolean>;
}

export class BrowserPrinterAdapter implements PrinterAdapter {
  async printReceipt(data: ReceiptData): Promise<boolean> {
    console.log('Generating browser print window for receipt:', data.orderId);
    // Real implementation would open a window and call window.print()
    return true;
  }
  
  async checkStatus(): Promise<boolean> {
    return true;
  }
}

export class ESCPOSPrinterAdapter implements PrinterAdapter {
  async printReceipt(data: ReceiptData): Promise<boolean> {
    console.log('Sending raw ESC/POS commands to thermal printer for receipt:', data.orderId);
    // Real implementation would connect via WebBluetooth or local proxy server
    return true;
  }

  async checkStatus(): Promise<boolean> {
    // Check printer connection status
    return true;
  }
}

export class ReceiptService {
  private adapter: PrinterAdapter;

  constructor(adapter: PrinterAdapter) {
    this.adapter = adapter;
  }

  setAdapter(adapter: PrinterAdapter) {
    this.adapter = adapter;
  }

  async print(data: ReceiptData) {
    const isReady = await this.adapter.checkStatus();
    if (!isReady) {
      throw new Error('Printer is not ready');
    }
    return await this.adapter.printReceipt(data);
  }
}

// Default to browser printing for now
export const receiptPrinter = new ReceiptService(new BrowserPrinterAdapter());
