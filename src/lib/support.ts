import { LEGAL } from '@/src/lib/legal';

/** E-mail de suporte. Se ficar vazio, usa o contato da política de privacidade. */
const SUPPORT_EMAIL = '';
/** WhatsApp com DDI e DDD, só números. Ex.: 5562999999999 */
const SUPPORT_WHATSAPP = '';

/** Contato mostrado na tela Conta; os botões só aparecem quando há valor. */
export const SUPPORT = {
  email: SUPPORT_EMAIL.trim() || LEGAL.contactEmail,
  whatsapp: SUPPORT_WHATSAPP.replace(/\D/g, ''),
};
