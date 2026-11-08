import { LegalDocument } from '@/src/components/ui/LegalDocument';
import { termsOfUse } from '@/src/lib/legal';

export default function TermsScreen() {
  return <LegalDocument title="Termos de Uso" sections={termsOfUse()} />;
}
