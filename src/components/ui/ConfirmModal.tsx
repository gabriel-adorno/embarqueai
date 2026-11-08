import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/theme/colors';

type Props = {
  visible: boolean;
  title: string;
  /** Texto explicativo abaixo do título. */
  body?: string;
  yesLabel?: string;
  noLabel?: string;
  /** Botão de confirmação em vermelho (ações destrutivas). */
  danger?: boolean;
  loading?: boolean;
  onYes: () => void;
  onNo: () => void;
};

export function ConfirmModal({
  visible,
  title,
  body,
  yesLabel = 'Sim',
  noLabel = 'Não',
  danger = false,
  loading = false,
  onYes,
  onNo,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onNo}>
      <Pressable
        style={styles.backdrop}
        onPress={onNo}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
      >
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}
          onPress={() => undefined}
          accessible={false}
        >
          <View style={styles.handle} />
          <Text style={[styles.title, body ? styles.titleWithBody : null]}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          <View style={styles.row}>
            <View style={styles.col}>
              <Button label={noLabel} variant="secondary" disabled={loading} onPress={onNo} />
            </View>
            <View style={styles.col}>
              <Button
                label={yesLabel}
                variant={danger ? 'danger' : 'primary'}
                loading={loading}
                onPress={onYes}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 20,
    letterSpacing: -0.4,
  },
  titleWithBody: { marginBottom: 10 },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
});
