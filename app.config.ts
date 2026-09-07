import type { ExpoConfig } from 'expo/config';

const googleKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  'https://embarqueai-api.gabrielviniciusadorno.workers.dev';

const mapsPlugin = googleKey
  ? ([
      'react-native-maps',
      {
        iosGoogleMapsApiKey: googleKey,
        androidGoogleMapsApiKey: googleKey,
      },
    ] as const)
  : ('react-native-maps' as const);

const config: ExpoConfig = {
  name: 'EmbarqueAI',
  slug: 'embarqueai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'embarqueai',
  userInterfaceStyle: 'light',
  extra: {
    apiUrl,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.vango.app',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'O EmbarqueAI usa sua localização para centralizar o mapa.',
    },
  },
  android: {
    package: 'com.vango.app',
    adaptiveIcon: {
      backgroundColor: '#2B6CB0',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'O EmbarqueAI usa sua localização para centralizar o mapa.',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#2B6CB0',
      },
    ],
    mapsPlugin as NonNullable<ExpoConfig['plugins']>[number],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
