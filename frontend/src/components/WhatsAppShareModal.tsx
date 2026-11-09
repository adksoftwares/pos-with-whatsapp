import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { MessageCircle } from 'lucide-react';
import { WhatsAppService } from '../services/whatsappService';
import toast from 'react-hot-toast';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: any;
  
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({ isOpen, onClose, receiptData }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');

  if (!receiptData) return null;

  const handleShare = async () => {
    if (!phoneNumber) {
      setError('Phone number is required');
      return;
    }

    if (!WhatsAppService.isValidPhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number (e.g. 0712345678)');
      return;
    }

    setError('');
    let copied = false;
    if (receiptData.imageBlob) {
      try {
        const textBlob = new Blob([previewMessage], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({ 
            'image/png': receiptData.imageBlob,
            'text/plain': textBlob
          })
        ]);
        copied = true;
      } catch (e: any) {
        console.error('Clipboard write failed:', e);
        toast.error('Clipboard write failed: ' + e.message);
      }
    }

    const deepLink = WhatsAppService.getWhatsAppDeepLink(phoneNumber, receiptData);
    const newWindow = window.open(deepLink, '_blank', 'noopener,noreferrer');
    
    if (newWindow) {
      if (copied) {
        toast.success('WhatsApp opened. Image Copied! Paste (Ctrl+V) to send.', { duration: 6000 });
      } else {
        toast.success('WhatsApp opened.');
      }
      onClose();
    } else {
      toast.error('Browser blocked WhatsApp window. Please allow pop-ups.');
    }
  };

  const previewMessage = WhatsAppService.generateMessage(receiptData);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send WhatsApp Bill" maxWidth="sm">
      <div className="space-y-4">
        <div>
          <Input 
            label="Customer WhatsApp Number" 
            placeholder="e.g. 071 234 5678"
            value={phoneNumber}
            onChange={(e) => { setPhoneNumber(e.target.value); setError(''); }}
            error={error}
          />
          <p className="text-xs text-gray-500 mt-1">
            Format: +9471XXXXXXX or local 071XXXXXXX
          </p>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Message Preview</p>
          <pre className="text-sm font-sans whitespace-pre-wrap text-gray-800">
            {previewMessage}
          </pre>
        </div>

        <div className="pt-2 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          
          {navigator.share && (
                                                            <Button variant="secondary" onClick={async () => {
              try {
                let shareData: any = {
                  title: `Receipt ${receiptData.orderNumber}`,
                  text: previewMessage,
                };
                if (receiptData.imageBlob) {
                  const file = new File([receiptData.imageBlob], `Invoice_${receiptData.orderNumber}.png`, { type: 'image/png' });
                  if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    shareData.files = [file];
                  }
                }
                await navigator.share(shareData);
              } catch (e: any) {
                toast.error('Share failed: ' + e.message);
              }
            }}>
              Share...
            </Button>
          )}

          <Button onClick={handleShare} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
            <MessageCircle size={18} />
            Open WhatsApp
          </Button>
        </div>
      </div>
    </Modal>
  );
};
