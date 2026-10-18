import { Linking } from 'react-native';

function digits(phone: string) {
  return phone.replace(/\D/g, '');
}

export function callPhone(phone: string) {
  const number = digits(phone);
  if (!number) return;
  void Linking.openURL(`tel:${number}`);
}

export function openWhatsApp(phone: string) {
  let number = digits(phone);
  if (!number) return;
  if (number.length <= 11) number = `55${number}`;
  void Linking.openURL(`https://wa.me/${number}`);
}
