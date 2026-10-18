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
  capacity?: number | null;
  photo?: string | null;
};

export type AlertReply = {
  id: string;
  alert_id: string;
  user_id: string;
  user_name?: string;
  message: string;
};

export type TripAlert = {
  id: string;
  trip_id: string;
  message: string;
  created_at: string;
  route_name?: string;
  replies?: AlertReply[];
};

export type TripReportRow = {
  route_name: string;
  started_at: string;
  ended_at: string | null;
  boarded: number;
  absent: number;
};

export type ReportSummary = {
  trips: number;
  boarded: number;
  absences: number;
  rows: TripReportRow[];
};

export type TripLeg = 'outbound' | 'return';

export type Route = {
  id: string;
  transporter_id: string;
  name: string;
  status: RouteStatus;
  outbound_time?: string | null;
  return_time?: string | null;
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
  point_id?: string | null;
};

export type Trip = {
  id: string;
  route_id: string;
  group_id: string;
  started_at: string;
  ended_at: string | null;
  status: TripStatus;
  leg?: TripLeg | null;
  polyline?: { lat: number; lng: number }[];
};

export type TripPosition = {
  trip_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
  remaining_m?: number | null;
  source?: 'gps' | 'sim';
};

export type BoardingStatus = 'boarded' | 'alighted';

export type Boarding = {
  id: string;
  trip_id: string;
  user_id: string;
  status: BoardingStatus;
  recorded_at: string;
};

export type Absence = {
  id: string;
  group_id: string;
  user_id: string;
  absent_on: string;
};

export type FollowStatus = 'pending' | 'accepted';

export type Follow = {
  id: string;
  guardian_id: string;
  passenger_id: string;
  status: FollowStatus;
  created_at: string;
  person?: Profile;
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
