export type Role = 'client' | 'transporter';

export type RouteStatus = 'draft' | 'active' | 'stopped';

export type TripStatus = 'in_progress' | 'ended';

export type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
};

export type Vehicle = {
  id: string;
  transporter_id: string;
  type: string;
  plate: string;
};

export type Route = {
  id: string;
  transporter_id: string;
  name: string;
  status: RouteStatus;
};

export type RoutePoint = {
  id: string;
  route_id: string;
  name: string;
  lat: number;
  lng: number;
  sort_order: number;
};

export type Group = {
  id: string;
  name: string;
  vehicle_id: string;
  route_id: string | null;
  transporter_id: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
};

export type Trip = {
  id: string;
  route_id: string;
  group_id: string;
  started_at: string;
  ended_at: string | null;
  status: TripStatus;
  polyline?: { lat: number; lng: number }[];
};

export type TripPosition = {
  trip_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
  remaining_m?: number | null;
};

export type AuthUser = {
  id: string;
  email: string;
  user_metadata: {
    name: string;
    role: Role;
  };
};

export type AuthSession = {
  user: AuthUser;
  access_token: string;
};

export type MapMarker = {
  id: string;
  title: string;
  lat: number;
  lng: number;
};

export type MapPolyline = {
  coordinates: { latitude: number; longitude: number }[];
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
