export class WhatsAppService {
  static normalizePhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    if (!cleaned) return '';

    // Sri Lanka specific normalization
    // If it starts with 0 and is 10 digits long (e.g., 0712345678)
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '94' + cleaned.substring(1);
    }
    
    // If it's a 9 digit number without leading zero (e.g., 712345678)
    if (cleaned.length === 9) {
      cleaned = '94' + cleaned;
    }

    return cleaned;
  }

  static isValidPhoneNumber(phone: string): boolean {
    const cleaned = this.normalizePhoneNumber(phone);
    // Generic validation: must be at least 10 digits and max 15 digits (E.164 standard)
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  static generateMessage(receiptData: any): string {
    const businessName = receiptData.business.name;
    const orderNumber = receiptData.orderNumber;
    const date = new Date(receiptData.completedAt || receiptData.createdAt).toLocaleDateString();
    const total = Number(receiptData.grandTotal).toFixed(2);
    
    const payment = receiptData.payments && receiptData.payments.length > 0 
      ? receiptData.payments[0] 
      : null;
    
    const paymentMethod = payment ? payment.method : 'N/A';
    
    let msg = `Hello,\n\nThank you for your purchase from *${businessName}*.\n\n`;
    msg += `Bill No: ${orderNumber}\n`;
    msg += `Date: ${date}\n`;
    msg += `Total: LKR ${total}\n`;
    msg += `Payment: ${paymentMethod}\n\n`;

    // Secure receipt link stub for future implementation
    // msg += `View your full receipt here: https://app.example.com/r/... \n\n`;

    msg += `Thank you for your business.`;

    return msg;
  }

  static getWhatsAppDeepLink(phone: string, receiptData: any): string {
    const normalizedNumber = this.normalizePhoneNumber(phone);
    const message = this.generateMessage(receiptData);
    const encodedMessage = encodeURIComponent(message);
    
    return `https://wa.me/${normalizedNumber}?text=${encodedMessage}`;
  }
}
