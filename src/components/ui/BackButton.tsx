import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { PremiumIcon } from '@/src/components/ui/PremiumIcon';
import { colors } from '@/src/theme/colors';

type Props = {
  light?: boolean;
};

export function BackButton({ light = false }: Props) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      hitSlop={8}
      style={[styles.btn, light && styles.light]}
    >
      <PremiumIcon name="back" size={18} color={light ? colors.white : colors.tabInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    boxShadow: '0px 6px 12px rgba(11, 18, 32, 0.1)',
  },
  light: {
    backgroundColor: 'rgba(18, 21, 26, 0.42)',
    borderColor: 'rgba(255,255,255,0.2)',
    boxShadow: 'none',
  },
});
