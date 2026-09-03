import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme/colors';
import type { AppMessageKind } from '@/src/lib/messages';

type Props = {
  title: string;
  body?: string;
  kind?: AppMessageKind;
  flush?: boolean;
};

const ICONS: Record<AppMessageKind, keyof typeof Ionicons.glyphMap> = {
  error: 'alert-circle',
  success: 'checkmark-circle',
  info: 'information-circle',
};

export function AppMessage({ title, body, kind = 'error', flush }: Props) {
  const palette = {
    error: { bg: colors.errorBg, fg: colors.error, icon: colors.error },
    success: { bg: colors.successBg, fg: colors.success, icon: colors.success },
    info: { bg: colors.iconBg, fg: colors.ink, icon: colors.primary },
  }[kind];

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: palette.bg }, flush && styles.flush]}
    >
      <Ionicons name={ICONS[kind]} size={22} color={palette.icon} />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: palette.fg }]}>{title}</Text>
        {body ? <Text style={[styles.body, { color: palette.fg }]}>{body}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  flush: { marginBottom: 0 },
  copy: { flex: 1 },
  title: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  body: { marginTop: 4, fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
