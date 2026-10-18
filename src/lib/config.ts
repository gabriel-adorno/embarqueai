import Constants from 'expo-constants';

/** Worker de produção — usado se o clone não tiver .env.local. */
export const DEFAULT_API_URL =
  'https://embarqueai-api.gabrielviniciusadorno.workers.dev';

export function getApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
  const fromExtra =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim() ?? '';
  const raw = fromEnv || fromExtra || DEFAULT_API_URL;
  if (raw === 'mock' || raw === 'off') return '';
  return raw.replace(/\/$/, '');
}

export function isRemote(): boolean {
  return getApiUrl().length > 0;
}

export function getGoogleMapsKey(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';
}
