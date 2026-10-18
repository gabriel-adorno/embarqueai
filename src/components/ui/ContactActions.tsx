import { StyleSheet, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { callPhone, openWhatsApp } from '@/src/lib/phone';

type Props = {
  phone: string | null | undefined;
};

export function ContactActions({ phone }: Props) {
  if (!phone?.trim()) return null;
  return (
    <View style={styles.row}>
      <View style={styles.item}>
        <Button label="Ligar" variant="secondary" onPress={() => callPhone(phone)} />
      </View>
      <View style={styles.item}>
        <Button label="WhatsApp" variant="secondary" onPress={() => openWhatsApp(phone)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  item: { flex: 1 },
});
