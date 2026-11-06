import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/src/theme/colors';

type Props = {
  children: ReactNode;
};

export function MapTopBar({ children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]}>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    pointerEvents: 'box-none',
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 4,
  },
  card: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(18, 21, 26, 0.08)',
    boxShadow: '0px 8px 18px rgba(11, 18, 32, 0.12)',
  },
});
