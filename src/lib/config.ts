import Constants from 'expo-constants';

export function getApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim() ?? '';
  return (fromEnv || fromExtra).replace(/\/$/, '');
}

export function isRemote(): boolean {
  return getApiUrl().length > 0;
}

export function getGoogleMapsKey(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';
}
