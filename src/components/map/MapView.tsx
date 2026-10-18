/**
 * MapView nativo. Google Maps quando EXPO_PUBLIC_GOOGLE_MAPS_API_KEY existe
 * (development build; Expo Go não carrega o SDK do Google no SDK 57).
 */
import { StyleSheet } from 'react-native';
import MapViewNative, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { getGoogleMapsKey } from '@/src/lib/config';
import { renderMap } from '@/src/services/maps';
import { colors } from '@/src/theme/colors';
import { MAP_STYLE } from '@/src/theme/mapStyle';
import type { MapMarker, MapPolyline, MapRegion } from '@/src/types/database';

type Props = {
  markers: MapMarker[];
  polyline?: MapPolyline;
  polylines?: MapPolyline[];
  initialRegion: MapRegion;
  showsUserLocation?: boolean;
  followUser?: boolean;
};

function lineList(polyline?: MapPolyline, polylines?: MapPolyline[]) {
  return [polyline, ...(polylines ?? [])].filter(
    (line): line is MapPolyline => Boolean(line?.coordinates?.length),
  );
}

export function MapView({
  markers,
  polyline,
  polylines,
  initialRegion,
  showsUserLocation = true,
  followUser = false,
}: Props) {
  const model = renderMap({ markers, polyline, initialRegion });
  const google = Boolean(getGoogleMapsKey());
  const lines = lineList(model.polyline, polylines);

  return (
    <MapViewNative
      style={styles.map}
      initialRegion={model.initialRegion}
      region={followUser ? model.initialRegion : undefined}
      provider={google ? PROVIDER_GOOGLE : undefined}
      customMapStyle={google ? MAP_STYLE : undefined}
      userInterfaceStyle="light"
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsCompass={false}
      showsScale={false}
      showsPointsOfInterest={false}
      showsBuildings={false}
      showsTraffic={false}
      toolbarEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      mapPadding={{ top: 88, right: 12, bottom: 280, left: 12 }}
      accessibilityLabel="Mapa da rota"
    >
      {model.markers.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={{ latitude: marker.lat, longitude: marker.lng }}
          title={marker.title}
        />
      ))}
      {lines.map((line, index) => (
        <Polyline
          key={`route-${index}`}
          coordinates={line.coordinates}
          strokeColor={colors.primary}
          strokeWidth={4}
        />
      ))}
    </MapViewNative>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
});
