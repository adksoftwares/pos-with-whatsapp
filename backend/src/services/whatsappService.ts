import { env } from '../config/env';
export interface WhatsAppMessageData { phoneNumber:string; orderId:string; total:number; pdfUrl?:string; textMessage:string; }
export class WhatsAppService {
 static generateShareLink(phoneNumber:string,message:string):string {const clean=phoneNumber.replace(/\D/g,'');return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;}
 static async sendViaAPI(data:WhatsAppMessageData):Promise<boolean>{
  if(!env.WHATSAPP_ACCESS_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID)throw new Error('WhatsApp Cloud API credentials are not configured');
  const phone=data.phoneNumber.replace(/\D/g,'');if(phone.length<10||phone.length>15)throw new Error('Invalid WhatsApp recipient number');
  const response=await fetch(`https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:phone,type:'text',text:{preview_url:true,body:data.textMessage}})});
  if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(`WhatsApp API request failed (${response.status}): ${JSON.stringify(payload)}`);}
  return true;
 }
}