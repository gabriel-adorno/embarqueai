import { Redirect, Stack } from 'expo-router';

import { useSessionStore } from '@/src/store/session';

export default function AppLayout() {
  const session = useSessionStore((s) => s.session);
  if (!session) return <Redirect href="/(auth)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
