import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/theme/colors';

type Props = {
  visible: boolean;
  title: string;
  onYes: () => void;
  onNo: () => void;
};

export function ConfirmModal({ visible, title, onYes, onNo }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onNo}>
      <Pressable style={styles.backdrop} onPress={onNo} accessibilityLabel="Fechar">
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}
          onPress={() => undefined}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Button label="Não" variant="secondary" onPress={onNo} />
            </View>
            <View style={styles.col}>
              <Button label="Sim" onPress={onYes} />
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
});
