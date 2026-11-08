import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
  /** Puxar para baixo recarrega os dados da tela (consultas ativas). */
  refreshable?: boolean;
};

export function Screen({
  children,
  showBack = false,
  showBrand = false,
  tab = false,
  scroll = true,
  keyboard = false,
  refreshable = false,
}: Props) {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await qc.refetchQueries({ type: 'active' });
    } finally {
      setRefreshing(false);
    }
  }, [qc]);
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
      refreshControl={
        refreshable ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
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
      <View style={styles.column}>
        {top}
        <View style={styles.fill}>{body}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
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
