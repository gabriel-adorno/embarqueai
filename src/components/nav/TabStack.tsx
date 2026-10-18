import { Stack } from 'expo-router';

import { colors } from '@/src/theme/colors';

type Props = {
  formScreens?: string[];
};

export function TabStack({ formScreens = [] }: Props) {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {formScreens.map((name) => (
        <Stack.Screen
          key={name}
          name={name}
          options={{ animation: 'slide_from_bottom' }}
        />
      ))}
    </Stack>
  );
}
