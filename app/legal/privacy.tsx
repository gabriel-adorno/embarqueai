import { LegalDocument } from '@/src/components/ui/LegalDocument';
import { privacyPolicy } from '@/src/lib/legal';

export default function PrivacyScreen() {
  return <LegalDocument title="Política de Privacidade" sections={privacyPolicy()} />;
}
