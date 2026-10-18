import { createElement, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { renderMap } from '@/src/services/maps';
import { colors } from '@/src/theme/colors';
import { USER_LOCATION_COLOR } from '@/src/theme/mapStyle';
import type { MapMarker, MapPolyline, MapRegion } from '@/src/types/database';

type Props = {
  markers: MapMarker[];
  polyline?: MapPolyline;
  polylines?: MapPolyline[];
  initialRegion: MapRegion;
  showsUserLocation?: boolean;
  followUser?: boolean;
};

type MapLibreMarker = {
  setLngLat: (lngLat: [number, number]) => MapLibreMarker;
  addTo: (map: unknown) => MapLibreMarker;
  remove: () => void;
};

type GeoJSONSource = { setData: (data: unknown) => void };

type MapLibreMap = {
  remove: () => void;
  resize: () => void;
  loaded: () => boolean;
  getSource: (id: string) => GeoJSONSource | undefined;
  getLayer: (id: string) => unknown;
  addSource: (id: string, source: Record<string, unknown>) => void;
  addLayer: (layer: Record<string, unknown>) => void;
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
  on: (event: string, cb: () => void) => void;
};

type MapLibreNs = {
  Map: new (opts: Record<string, unknown>) => MapLibreMap;
  Marker: new (opts: { element: HTMLElement; anchor?: string }) => MapLibreMarker;
};

declare global {
  interface Window {
    maplibregl?: MapLibreNs;
  }
}

const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

let mapLibreLoader: Promise<MapLibreNs> | null = null;

function zoomFromDelta(latitudeDelta: number) {
  return Math.max(14, Math.min(16, Math.round(Math.log2(360 / Math.max(latitudeDelta, 0.002)))));
}

function loadMapLibre(): Promise<MapLibreNs> {
  if (window.maplibregl?.Map) return Promise.resolve(window.maplibregl);
  if (mapLibreLoader) return mapLibreLoader;

  mapLibreLoader = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-embarqueai-maplibre]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = MAPLIBRE_CSS;
      link.dataset.embarqueaiMaplibre = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('style[data-embarqueai-map]')) {
      const style = document.createElement('style');
      style.dataset.embarqueaiMap = '1';
      style.textContent = `
        .embarqueai-map .maplibregl-canvas {
          outline: none;
          filter: saturate(0.72) contrast(0.96) brightness(1.04);
        }
        .embarqueai-map .maplibregl-ctrl-attrib {
          background: rgba(255,255,255,0.72);
          color: #9aa0a6;
          font-size: 10px;
        }
        .embarqueai-map .maplibregl-ctrl-attrib a { color: #9aa0a6; }
        .embarqueai-map .maplibregl-ctrl-bottom-left,
        .embarqueai-map .maplibregl-ctrl-bottom-right { margin: 8px; }
        .embarqueai-puck {
          width: 18px; height: 18px;
          border-radius: 50%;
          background: ${USER_LOCATION_COLOR};
          border: 3px solid #fff;
          box-shadow: 0 0 0 1px rgba(47,128,237,0.25), 0 8px 16px rgba(15,23,42,0.18);
          position: relative;
        }
        .embarqueai-puck::after {
          content: '';
          position: absolute; inset: -10px;
          border-radius: 50%;
          background: rgba(47,128,237,0.22);
          animation: embarqueai-pulse 2.2s ease-out infinite;
        }
        @keyframes embarqueai-pulse {
          0% { transform: scale(0.55); opacity: 0.7; }
          100% { transform: scale(1.35); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    const onReady = () => {
      if (window.maplibregl?.Map) resolve(window.maplibregl);
      else reject(new Error('MapLibre não carregou.'));
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-embarqueai-maplibre]');
    if (existing) {
      if (window.maplibregl?.Map) onReady();
      else existing.addEventListener('load', onReady);
      existing.addEventListener('error', () => reject(new Error('MapLibre não carregou.')));
      return;
    }
    const script = document.createElement('script');
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.dataset.embarqueaiMaplibre = '1';
    script.onload = onReady;
    script.onerror = () => {
      mapLibreLoader = null;
      reject(new Error('MapLibre não carregou.'));
    };
    document.head.appendChild(script);
  });

  return mapLibreLoader;
}

function lineList(polyline?: MapPolyline, polylines?: MapPolyline[]) {
  return [polyline, ...(polylines ?? [])].filter(
    (line): line is MapPolyline => Boolean(line?.coordinates?.length),
  );
}

function lineData(polyline?: MapPolyline) {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: (polyline?.coordinates ?? []).map((c) => [c.longitude, c.latitude]),
    },
  };
}

function syncOverlays(
  ml: MapLibreNs,
  map: MapLibreMap,
  markers: MapMarker[],
  polylines: MapPolyline[],
  markerBag: Map<string, MapLibreMarker>,
) {
  polylines.forEach((polyline, index) => {
    const sourceId = `route-${index}`;
    const layerId = `route-line-${index}`;
    const data = lineData(polyline);
    const source = map.getSource(sourceId);
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource(sourceId, { type: 'geojson', data });
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': colors.primary,
        'line-width': 4,
        'line-opacity': 0.9,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  });

  const nextIds = new Set(markers.map((m) => m.id));
  for (const [id, marker] of markerBag) {
    if (!nextIds.has(id)) {
      marker.remove();
      markerBag.delete(id);
    }
  }
  for (const marker of markers) {
    const existing = markerBag.get(marker.id);
    if (existing) {
      existing.setLngLat([marker.lng, marker.lat]);
      continue;
    }
    const isVan = marker.id === 'van';
    const dot = document.createElement('div');
    if (isVan) {
      dot.className = 'embarqueai-puck';
    } else {
      dot.style.cssText = `width:14px;height:14px;border-radius:50%;background:${colors.primary};border:2px solid #fff;box-shadow:0 4px 10px rgba(15,23,42,0.16)`;
    }
    const pin = new ml.Marker({ element: dot, anchor: 'center' })
      .setLngLat([marker.lng, marker.lat])
      .addTo(map);
    markerBag.set(marker.id, pin);
  }
}

function MapCanvas({
  markers,
  polyline,
  polylines,
  initialRegion,
  showsUserLocation,
}: Props & { showsUserLocation: boolean }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const model = renderMap({ markers, polyline, initialRegion });
  const lines = lineList(model.polyline, polylines);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mlRef = useRef<MapLibreNs | null>(null);
  const markersRef = useRef(new Map<string, MapLibreMarker>());
  const startedRef = useRef(false);
  const overlaysRef = useRef({
    markers: model.markers,
    lines,
    showsUserLocation,
    userLng: initialRegion.longitude,
    userLat: initialRegion.latitude,
  });
  overlaysRef.current = {
    markers: model.markers,
    lines,
    showsUserLocation,
    userLng: initialRegion.longitude,
    userLat: initialRegion.latitude,
  };

  useEffect(() => {
    if (!host) return;
    let cancelled = false;

    loadMapLibre()
      .then((ml) => {
        if (cancelled || !host.isConnected) return;
        mlRef.current = ml;
        host.replaceChildren();
        const el = document.createElement('div');
        el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
        host.appendChild(el);

        const instance = new ml.Map({
          container: el,
          style: MAP_STYLE_URL,
          center: [initialRegion.longitude, initialRegion.latitude],
          zoom: zoomFromDelta(initialRegion.latitudeDelta),
          attributionControl: { compact: true },
          pitchWithRotate: false,
        });

        instance.on('load', () => {
          if (cancelled) return;
          instance.setPadding({ top: 88, right: 12, bottom: 260, left: 12 });
          instance.resize();
          startedRef.current = true;
          const next = overlaysRef.current;
          syncOverlays(ml, instance, next.markers, next.lines, markersRef.current);
          if (next.showsUserLocation && !markersRef.current.has('__user')) {
            const puck = document.createElement('div');
            puck.className = 'embarqueai-puck';
            const pin = new ml.Marker({ element: puck, anchor: 'center' })
              .setLngLat([next.userLng, next.userLat])
              .addTo(instance);
            markersRef.current.set('__user', pin);
          }
        });

        mapRef.current = instance;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      startedRef.current = false;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Create the map once per host. Overlays update in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  useEffect(() => {
    const map = mapRef.current;
    const ml = mlRef.current;
    if (!map || !ml || !startedRef.current) return;
    syncOverlays(ml, map, model.markers, lines, markersRef.current);
  }, [model.markers, lines]);

  return createElement('div', {
    ref: setHost,
    className: 'embarqueai-map',
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  });
}

export function MapView(props: Props) {
  return (
    <View style={styles.map}>
      <MapCanvas {...props} showsUserLocation={props.showsUserLocation ?? true} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#f4f4f2',
  },
});
