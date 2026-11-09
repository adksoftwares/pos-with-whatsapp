// WhatsApp Integration Foundation

export interface WhatsAppMessageData {
  phoneNumber: string;
  orderId: string;
  total: number;
  pdfUrl?: string;
  textMessage: string;
}

export class WhatsAppService {
  /**
   * Generates a wa.me link for browser-based sharing
   */
  static generateShareLink(phoneNumber: string, message: string): string {
    const encodedMessage = encodeURIComponent(message);
    // Ensure phone number has country code but no + or spaces
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }

  /**
   * Future implementation for WhatsApp Business API
   * Will send automated messages directly without user interaction
   */
  static async sendViaAPI(data: WhatsAppMessageData): Promise<boolean> {
    console.log(`[WhatsApp API Placeholder] Sending receipt ${data.orderId} to ${data.phoneNumber}`);
    // await apiClient.post('https://graph.facebook.com/v17.0/...', ...)
    return true;
  }
}
