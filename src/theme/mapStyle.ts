/** Visual próximo do Google Maps usado por iFood/Uber: claro, com ruas, parques e nomes. */
export const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 2 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#d1d5db' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#eef3ea' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e9e9e9' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -45 }, { lightness: 15 }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8b95a1' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d4ead0' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#5f8a6a' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e5e7eb' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#ffe08a' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#f0d48a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#6b5b2a' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c5d7e8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6a8aaa' }] },
];

export const USER_LOCATION_COLOR = '#2F80ED';
