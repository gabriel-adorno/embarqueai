import { Redirect } from 'expo-router';

import { href } from '@/src/lib/href';
import { useSessionStore } from '@/src/store/session';

export default function Index() {
  const session = useSessionStore((s) => s.session);
  if (session) return <Redirect href={href('/(app)/(tabs)')} />;
  return <Redirect href="/(auth)" />;
}
