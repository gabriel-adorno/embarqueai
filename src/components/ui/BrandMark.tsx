import { PremiumIcon } from '@/src/components/ui/PremiumIcon';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';

type Props = {
  compact?: boolean;
  inverted?: boolean;
};

export function BrandMark({ compact = false, inverted = false }: Props) {
  const size = compact ? 36 : 48;
  const ink = inverted ? colors.white : colors.ink;
  const markBg = inverted ? colors.white : colors.primary;
  const iconColor = inverted ? colors.primary : colors.white;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel="EmbarqueAI"
    >
      <View style={[styles.mark, { width: size, height: size, backgroundColor: markBg }]}>
        <PremiumIcon name="bus" color={iconColor} size={compact ? 18 : 24} />
      </View>
      <Text style={[styles.wordmark, compact && styles.wordmarkSm, { color: ink }]}>
        Embarque<Text style={{ color: inverted ? colors.accent : colors.primary }}>AI</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  wordmarkSm: {
    fontSize: 18,
  },
});
