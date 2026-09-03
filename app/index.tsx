import { Redirect } from 'expo-router';

import { useSessionStore } from '@/src/store/session';

export default function Index() {
  const session = useSessionStore((s) => s.session);
  if (session) return <Redirect href="/(app)/(tabs)" />;
  return <Redirect href="/(auth)" />;
}
