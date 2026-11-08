import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { colors } from '@/src/theme/colors';

type Props = TextInputProps & {
  label: string;
  error?: string;
};

export function Input({ label, error, secureTextEntry, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isPassword = Boolean(secureTextEntry);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={label}
          {...rest}
          secureTextEntry={isPassword && hidden}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            isPassword && styles.inputWithToggle,
            focused && styles.focus,
            Boolean(error) && styles.error,
            rest.style,
          ]}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            style={styles.toggle}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? `Mostrar ${label.toLowerCase()}` : `Ocultar ${label.toLowerCase()}`}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
  },
  inputWithToggle: { paddingRight: 52 },
  focus: {
    borderColor: colors.primary,
    boxShadow: '0px 3px 8px rgba(43, 108, 176, 0.12)',
  },
  error: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    marginTop: 6,
    fontSize: 13,
  },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
