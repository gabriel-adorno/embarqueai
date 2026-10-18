import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppMessage } from '@/src/components/ui/AppMessage';
import { useToastStore } from '@/src/store/toast';

export function ToastHost() {
  const flash = useToastStore((s) => s.flash);
  const hide = useToastStore((s) => s.hide);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(hide, 3600);
    return () => clearTimeout(t);
  }, [flash, hide]);

  if (!flash) return null;

  return (
    <View pointerEvents="none" style={styles.host}>
      <AppMessage flush title={flash.title} body={flash.body} kind={flash.kind} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    zIndex: 80,
  },
});
