import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { iconFromIon, PremiumIcon } from '@/src/components/ui/PremiumIcon';
import { colors } from '@/src/theme/colors';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  glyph?: string;
  onPress?: () => void;
};

export function ListRow({ icon, title, subtitle, glyph, onPress }: Props) {
  const inner = (
    <>
      <View style={styles.iconBox}>
        {glyph ? (
          <Text style={styles.glyph}>{glyph}</Text>
        ) : (
          <PremiumIcon name={iconFromIon(icon)} color={colors.tabInk} size={20} />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {onPress ? (
        <View style={styles.chevron}>
          <PremiumIcon name="chevron" color={colors.tabMuted} size={16} />
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{inner}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(18, 21, 26, 0.06)',
    shadowColor: '#0B1220',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 22 },
  copy: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.tabInk,
    letterSpacing: -0.3,
  },
  sub: { color: colors.textMuted, marginTop: 3, fontSize: 13, lineHeight: 18 },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
