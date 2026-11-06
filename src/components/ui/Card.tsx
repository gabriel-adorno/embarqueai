import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors } from '@/src/theme/colors';

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
    boxShadow: '0px 4px 12px rgba(22, 58, 107, 0.06)',
  },
});
