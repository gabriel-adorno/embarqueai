import { StyleSheet, Text, View } from 'react-native';

import { renderMap } from '@/src/services/maps';
import { colors } from '@/src/theme/colors';
import type { MapMarker, MapPolyline, MapRegion } from '@/src/types/database';

type Props = {
  markers: MapMarker[];
  polyline?: MapPolyline;
  initialRegion: MapRegion;
};

export function MapView(props: Props) {
  renderMap(props);
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>
        Mapa nativo no iOS e Android. Este adapter não usa Google Maps no MVP.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
  },
  fallbackText: {
    textAlign: 'center',
    color: colors.textSecondary,
  },
});
