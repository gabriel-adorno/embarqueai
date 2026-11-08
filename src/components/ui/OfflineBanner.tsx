import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/src/theme/colors';

/** Faixa no topo quando o aparelho fica sem internet. */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  if (!offline) return null;
  return (
    <View
      style={[styles.bar, { paddingTop: insets.top + 6 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>Sem internet. Os dados vão atualizar quando a conexão voltar.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    backgroundColor: colors.strongBg,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  text: { color: colors.strongFg, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
