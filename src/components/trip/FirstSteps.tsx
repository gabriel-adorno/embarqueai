import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { href } from '@/src/lib/href';
import { colors } from '@/src/theme/colors';

type Props = { vehicles: number; groups: number; routes: number };

/** Passo a passo do transportador novo: veículo → grupo (com passageiros) → rota. */
export function FirstSteps({ vehicles, groups, routes }: Props) {
  const router = useRouter();
  const steps = [
    {
      title: 'Cadastre o veículo',
      hint: 'Tipo, placa e lugares.',
      done: vehicles > 0,
      go: () => router.push(href('/(app)/(tabs)/vehicles/new')),
    },
    {
      title: 'Crie o grupo e adicione os passageiros',
      hint: 'Escolha o veículo e convide pelo e-mail de cada passageiro.',
      done: groups > 0,
      go: () => router.push(href('/(app)/(tabs)/groups/new')),
    },
    {
      title: 'Crie a rota',
      hint: 'Pontos de parada, horários e os grupos que vão nela.',
      done: routes > 0,
      go: () => router.push(href('/(app)/(tabs)/routes/new')),
    },
  ];
  const next = steps.findIndex((step) => !step.done);

  return (
    <View style={styles.list}>
      {steps.map((step, index) => {
        const current = index === next;
        const blocked = next !== -1 && index > next;
        return (
          <Pressable
            key={step.title}
            onPress={step.go}
            disabled={blocked}
            accessibilityRole="button"
            accessibilityState={{ disabled: blocked, checked: step.done }}
            accessibilityLabel={`Passo ${index + 1}: ${step.title}${step.done ? ', concluído' : ''}`}
            style={[styles.step, current && styles.stepCurrent, blocked && styles.stepBlocked]}
          >
            <View style={[styles.badge, step.done && styles.badgeDone, current && styles.badgeCurrent]}>
              <Text style={[styles.badgeText, (step.done || current) && styles.badgeTextOn]}>
                {step.done ? '✓' : index + 1}
              </Text>
            </View>
            <View style={styles.body}>
              <Text style={[styles.title, step.done && styles.titleDone]}>{step.title}</Text>
              <Text style={styles.hint}>{step.hint}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, marginTop: 4 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stepCurrent: { borderColor: colors.primary, borderWidth: 2 },
  stepBlocked: { opacity: 0.55 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  badgeDone: { backgroundColor: colors.live, borderColor: colors.live },
  badgeCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  badgeText: { fontWeight: '800', color: colors.textMuted },
  badgeTextOn: { color: colors.white },
  body: { flex: 1 },
  title: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  titleDone: { color: colors.textMuted },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
