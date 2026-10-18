import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PremiumIcon } from '@/src/components/ui/PremiumIcon';
import { colors } from '@/src/theme/colors';

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  hint,
  glyph = '🗺️',
}: {
  title: string;
  hint?: string;
  glyph?: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Text style={styles.glyph}>{glyph}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.text}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <PremiumIcon name="compass" color={colors.error} size={22} />
      <Text style={styles.error}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  empty: {
    marginTop: 8,
    padding: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(18, 21, 26, 0.06)',
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  glyph: { fontSize: 26 },
  text: {
    marginTop: 6,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.tabInk,
    textAlign: 'center',
  },
  error: {
    color: colors.error,
    textAlign: 'center',
  },
});
