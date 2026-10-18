import { Tabs } from 'expo-router';

import { DriverTracker } from '@/src/components/trip/DriverTracker';
import { TransporterDesk } from '@/src/components/trip/TransporterDesk';
import { FamilyNotifier } from '@/src/components/trip/FamilyNotifier';
import { FloatingTabBar } from '@/src/components/ui/FloatingTabBar';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/session';

export default function TabsLayout() {
  const family = useSessionStore((s) => s.session?.user.user_metadata.role) !== 'transporter';
  return (
    <>
    <DriverTracker />
    <TransporterDesk />
    <FamilyNotifier />
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background, flex: 1 },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 0,
        },
        tabBarBackground: () => null,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="people" options={{ title: 'Pessoas', href: family ? undefined : null }} />
      <Tabs.Screen name="groups" options={{ title: 'Grupos', href: family ? null : undefined }} />
      <Tabs.Screen name="routes" options={{ title: 'Rotas', href: family ? null : undefined }} />
      <Tabs.Screen name="vehicles" options={{ title: 'Veículos', href: family ? null : undefined }} />
      <Tabs.Screen name="profile" options={{ title: 'Conta' }} />
    </Tabs>
    </>
  );
}
