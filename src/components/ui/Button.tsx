import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';

import { colors } from '@/src/theme/colors';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

type Props = PressableProps & {
  label: string;
  loading?: boolean;
  variant?: Variant;
};

export function Button({
  label,
  loading,
  variant = 'primary',
  disabled,
  ...rest
}: Props) {
  const palette = {
    primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
    secondary: {
      bg: colors.white,
      fg: colors.primary,
      border: colors.border,
    },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: {
      bg: colors.white,
      fg: colors.danger,
      border: colors.danger,
    },
    success: {
      bg: colors.primary,
      fg: colors.white,
      border: colors.primary,
    },
  }[variant];

  const isSolid = variant === 'primary' || variant === 'success';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isSolid && styles.elevated,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled || loading ? 0.5 : pressed ? 0.88 : 1,
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: 54,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  elevated: {
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
