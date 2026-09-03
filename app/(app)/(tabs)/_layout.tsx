import { Tabs } from 'expo-router';

import { FloatingTabBar } from '@/src/components/ui/FloatingTabBar';
import { colors } from '@/src/theme/colors';
import { useRole } from '@/src/store/session';

export default function TabsLayout() {
  const role = useRole();
  const isTransporter = role === 'transporter';

  return (
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
      <Tabs.Screen name="groups" options={{ title: 'Grupos' }} />
      <Tabs.Screen
        name="routes"
        options={{
          title: 'Rotas',
          href: isTransporter ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Conta' }} />
    </Tabs>
  );
}
