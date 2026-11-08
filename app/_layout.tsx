import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { OfflineBanner } from '@/src/components/ui/OfflineBanner';
import { ToastHost } from '@/src/components/ui/ToastHost';
import '@/src/tasks/driverLocation';
import { queryClient } from '@/src/lib/queryClient';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/session';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const hydrate = useSessionStore((s) => s.hydrate);
  const hydrated = useSessionStore((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="legal/privacy" />
        <Stack.Screen name="legal/terms" />
      </Stack>
      <OfflineBanner />
      <ToastHost />
    </QueryClientProvider>
  );
}
