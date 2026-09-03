/**
 * MapView nativo via adapter. NÃO setar PROVIDER_GOOGLE.
 * NÃO ler GOOGLE_MAPS_API_KEY. Provider padrão da plataforma (Apple no iOS).
 * Depois: Google Maps SDK + Directions.
 */
import { StyleSheet } from 'react-native';
import MapViewNative, { Marker, Polyline } from 'react-native-maps';

import { renderMap } from '@/src/services/maps';
import { colors } from '@/src/theme/colors';
import type { MapMarker, MapPolyline, MapRegion } from '@/src/types/database';

type Props = {
  markers: MapMarker[];
  polyline?: MapPolyline;
  initialRegion: MapRegion;
};

export function MapView({ markers, polyline, initialRegion }: Props) {
  const model = renderMap({ markers, polyline, initialRegion });

  return (
    <MapViewNative
      style={styles.map}
      initialRegion={model.initialRegion}
      accessibilityLabel="Mapa da rota"
    >
      {model.markers.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={{ latitude: marker.lat, longitude: marker.lng }}
          title={marker.title}
        />
      ))}
      {model.polyline ? (
        <Polyline
          coordinates={model.polyline.coordinates}
          strokeColor={colors.primary}
          strokeWidth={4}
        />
      ) : null}
    </MapViewNative>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
});
