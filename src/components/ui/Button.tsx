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
  size?: 'md' | 'sm';
};

export function Button({
  label,
  loading,
  variant = 'primary',
  size = 'md',
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
        size === 'sm' && styles.sm,
        isSolid && size === 'md' && styles.elevated,
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
        <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: palette.fg }]}>
          {label}
        </Text>
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
    boxShadow: '0px 6px 10px rgba(22, 58, 107, 0.28)',
  },
  sm: {
    minHeight: 42,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  labelSm: {
    fontSize: 14,
  },
});
