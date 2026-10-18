import { PremiumIcon } from '@/src/components/ui/PremiumIcon';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/src/components/ui/BrandMark';
import { GradientHeader } from '@/src/components/ui/GradientHeader';
import { colors } from '@/src/theme/colors';

type Props = {
  showBrand?: boolean;
  showBack?: boolean;
  title?: string;
};

export function AppHeader({ showBrand = false, showBack = false, title }: Props) {
  const router = useRouter();

  return (
    <GradientHeader>
      <View style={headerStyles.row}>
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={8}
            style={headerStyles.back}
          >
            <PremiumIcon name="back" size={20} color={colors.white} />
          </Pressable>
        ) : (
          <View style={headerStyles.spacer} />
        )}
        {showBrand ? (
          <BrandMark compact inverted />
        ) : title ? (
          <Text style={headerStyles.title}>{title}</Text>
        ) : (
          <View />
        )}
        <View style={headerStyles.spacer} />
      </View>
    </GradientHeader>
  );
}

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  spacer: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },
});
