import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import { type } from '@/src/theme/typography';

type Props = {
  title: string;
  subtitle?: string;
};

export function ScreenTitle({ title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.accent} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 28,
  },
  accent: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.accent,
    marginBottom: 12,
  },
  title: {
    fontSize: type.display,
    fontWeight: '800',
    color: colors.tabInk,
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
