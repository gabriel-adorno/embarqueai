import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { colors } from '@/src/theme/colors';

const HIGHLIGHTS = [
  { glyph: '📍', text: 'Veja a van chegando no mapa, em tempo real.' },
  { glyph: '🔔', text: 'Avisos de embarque, desembarque e atraso.' },
  { glyph: '🚐', text: 'Para transportadores: rotas, grupos e trajeto.' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <Screen showBrand scroll={false}>
      <View style={styles.body}>
        <ScreenTitle title="Bem-vindo" subtitle="O transporte escolar e de trabalho, acompanhado de perto." />
        <View style={styles.list}>
          {HIGHLIGHTS.map((item) => (
            <View key={item.text} style={styles.row}>
              <View style={styles.iconWrap}>
                <Text style={styles.glyph}>{item.glyph}</Text>
              </View>
              <Text style={styles.rowText}>{item.text}</Text>
            </View>
          ))}
        </View>
        <Button label="Entrar" onPress={() => router.push('/(auth)/login')} />
        <View style={styles.gap}>
          <Button label="Criar conta" variant="secondary" onPress={() => router.push('/(auth)/sign-up')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center' },
  list: { gap: 12, marginBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 20 },
  rowText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 21 },
  gap: { marginTop: 12 },
});
