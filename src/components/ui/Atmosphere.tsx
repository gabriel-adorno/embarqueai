import { StyleSheet, View } from 'react-native';

import { colors } from '@/src/theme/colors';

export function Atmosphere() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.orbA} />
      <View style={styles.orbB} />
      <View style={styles.orbC} />
    </View>
  );
}

const styles = StyleSheet.create({
  orbA: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(43, 108, 176, 0.12)',
  },
  orbB: {
    position: 'absolute',
    top: 180,
    left: -90,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(94, 234, 212, 0.14)',
  },
  orbC: {
    position: 'absolute',
    bottom: 80,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(58, 134, 200, 0.1)',
  },
});
