import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/src/theme/colors';

type Props = {
  children: ReactNode;
  floating?: boolean;
};

export function BottomSheet({ children, floating = false }: Props) {
  return (
    <View style={[styles.sheet, floating && styles.floating]}>
      <View style={styles.handle} accessibilityElementsHidden />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.glass,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderBottomWidth: 0,
    boxShadow: '0px -10px 28px rgba(11, 18, 32, 0.16)',
  },
  floating: {
    borderRadius: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.handle,
    marginBottom: 14,
  },
});
