import { Stack } from 'expo-router';

import { colors } from '@/src/theme/colors';

export default function GroupsStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="van/[id]" />
    </Stack>
  );
}
