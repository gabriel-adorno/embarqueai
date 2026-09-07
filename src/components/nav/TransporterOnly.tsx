import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';

import { Screen } from '@/src/components/ui/Screen';
import { LoadingState } from '@/src/components/ui/States';
import { href } from '@/src/lib/href';
import { useSessionStore } from '@/src/store/session';

export function TransporterOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: string;
}) {
  const hydrated = useSessionStore((s) => s.hydrated);
  const user = useSessionStore((s) => s.session?.user);

  if (!hydrated || !user) {
    return (
      <Screen tab>
        <LoadingState />
      </Screen>
    );
  }

  if (user.user_metadata.role !== 'transporter') {
    return <Redirect href={href(fallback)} />;
  }

  return <>{children}</>;
}
