export class EscPosCommandBuilder {
  private buffer: number[] = [];

  // Basic ESC/POS commands
  static readonly ESC = 0x1b;
  static readonly GS = 0x1d;
  static readonly LF = 0x0a;

  init() {
    this.buffer.push(EscPosCommandBuilder.ESC, 0x40);
    return this;
  }

  alignCenter() {
    this.buffer.push(EscPosCommandBuilder.ESC, 0x61, 0x01);
    return this;
  }

  alignLeft() {
    this.buffer.push(EscPosCommandBuilder.ESC, 0x61, 0x00);
    return this;
  }

  alignRight() {
    this.buffer.push(EscPosCommandBuilder.ESC, 0x61, 0x02);
    return this;
  }

  bold(enable: boolean) {
    this.buffer.push(EscPosCommandBuilder.ESC, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  text(str: string) {
    // Simple ASCII/UTF-8 byte encoder. 
    // True thermal printers often need specific Code Page transformations (e.g. PC858).
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  feed(lines = 1) {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(EscPosCommandBuilder.LF);
    }
    return this;
  }

  cut() {
    this.buffer.push(EscPosCommandBuilder.GS, 0x56, 0x41, 0x03);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export class EscPosReceiptFormatter {
  static format(receiptData: any, paperWidth: '58mm' | '80mm'): Uint8Array {
    const builder = new EscPosCommandBuilder();
    const charWidth = paperWidth === '58mm' ? 32 : 48;

    builder.init().alignCenter().bold(true);
    builder.text(receiptData.business.name).feed();
    builder.bold(false);

    if (receiptData.business.phone) builder.text(`Tel: ${receiptData.business.phone}`).feed();
    builder.feed();

    builder.alignLeft();
    builder.text(`Receipt: ${receiptData.orderNumber}`).feed();
    builder.text(`Date: ${new Date(receiptData.createdAt).toLocaleString()}`).feed();
    builder.text('-'.repeat(charWidth)).feed();

    builder.text('ITEM'.padEnd(charWidth - 14) + 'QTY'.padStart(4) + 'AMOUNT'.padStart(10)).feed();
    builder.text('-'.repeat(charWidth)).feed();

    receiptData.items.forEach((item: any) => {
      // Very basic wrapping logic for item names
      const name = item.productName.substring(0, charWidth - 14).padEnd(charWidth - 14);
      const qty = Number(item.quantity).toString().padStart(4);
      const amt = Number(item.lineTotal).toFixed(2).padStart(10);
      builder.text(name + qty + amt).feed();
    });

    builder.text('-'.repeat(charWidth)).feed();
    builder.alignRight();
    builder.text(`Total: ${Number(receiptData.grandTotal).toFixed(2)}`).feed();
    
    if (receiptData.payments && receiptData.payments.length > 0) {
      builder.text(`Paid: ${Number(receiptData.payments[0].amount).toFixed(2)}`).feed();
    }
    
    builder.feed().alignCenter();
    builder.text(receiptData.business.receiptFooter || 'Thank you for your purchase!').feed();
    builder.feed(3).cut();

    return builder.build();
  }
}
