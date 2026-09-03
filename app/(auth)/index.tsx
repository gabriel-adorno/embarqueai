import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PremiumIcon } from '@/src/components/ui/PremiumIcon';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { colors } from '@/src/theme/colors';

export default function RoleSelectScreen() {
  const router = useRouter();
  return (
    <Screen showBrand scroll={false}>
      <View style={styles.body}>
        <ScreenTitle title="Bem-vindo" subtitle="Escolha como você embarca hoje." />
        <RoleTile
          glyph="📍"
          title="Cliente"
          subtitle="Acompanhe a van no mapa, ao vivo"
          onPress={() => router.push('/(auth)/login?role=client')}
        />
        <RoleTile
          glyph="🚐"
          title="Transportador"
          subtitle="Rotas, veículos, grupos e trajeto"
          onPress={() => router.push('/(auth)/login?role=transporter')}
        />
      </View>
    </Screen>
  );
}

function RoleTile({
  glyph,
  title,
  subtitle,
  onPress,
}: {
  glyph: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.glyph}>{glyph}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSub}>{subtitle}</Text>
      </View>
      <View style={styles.arrow}>
        <PremiumIcon name="chevron" size={16} color={colors.white} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center' },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(18, 21, 26, 0.08)',
    shadowColor: '#0B1220',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 22 },
  copy: { flex: 1 },
  tileTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.tabInk,
    letterSpacing: -0.3,
  },
  tileSub: { marginTop: 4, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.tabInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
