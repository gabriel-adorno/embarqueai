import * as ImagePicker from 'expo-image-picker';
import { Image, StyleSheet, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { notifyError } from '@/src/lib/notify';

type Props = {
  photo: string | null;
  onChange: (photo: string | null) => void;
};

export function VehiclePhotoField({ photo, onChange }: Props) {
  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      notifyError('Permita o acesso às fotos para escolher a imagem do veículo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const data = `data:image/jpeg;base64,${result.assets[0].base64}`;
    if (data.length > 280_000) {
      notifyError('Essa foto ficou grande demais. Escolha outra.');
      return;
    }
    onChange(data);
  };

  return (
    <View style={styles.wrap}>
      {photo ? <Image source={{ uri: photo }} style={styles.image} /> : null}
      <Button
        size="sm"
        variant="secondary"
        label={photo ? 'Trocar foto' : 'Adicionar foto'}
        onPress={() => void pick()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 16 },
  image: { width: 96, height: 96, borderRadius: 20 },
});
