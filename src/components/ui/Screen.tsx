import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Atmosphere } from '@/src/components/ui/Atmosphere';
import { BackButton } from '@/src/components/ui/BackButton';
import { BrandMark } from '@/src/components/ui/BrandMark';
import { colors } from '@/src/theme/colors';
import { PAGE_PADDING, TAB_SCREEN_BOTTOM } from '@/src/theme/layout';

type Props = {
  children: ReactNode;
  showBack?: boolean;
  showBrand?: boolean;
  tab?: boolean;
  scroll?: boolean;
  keyboard?: boolean;
};

export function Screen({
  children,
  showBack = false,
  showBrand = false,
  tab = false,
  scroll = true,
  keyboard = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const paddingBottom = tab ? TAB_SCREEN_BOTTOM : Math.max(insets.bottom, 16) + 24;

  const top =
    showBack || showBrand ? (
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        {showBack ? <BackButton /> : <View style={styles.side} />}
        {showBrand ? <BrandMark compact /> : <View style={styles.flex} />}
        <View style={styles.side} />
      </View>
    ) : (
      <View style={{ height: insets.top + 8 }} />
    );

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.pad, { paddingBottom }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, styles.pad, { paddingBottom }]}>{children}</View>
  );

  const body = keyboard ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.fill}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return (
    <View style={styles.root}>
      <Atmosphere />
      {top}
      <View style={styles.fill}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 8,
  },
  side: { width: 44, height: 44 },
  flex: { flex: 1, alignItems: 'center' },
  pad: {
    paddingHorizontal: PAGE_PADDING,
    flexGrow: 1,
  },
});
