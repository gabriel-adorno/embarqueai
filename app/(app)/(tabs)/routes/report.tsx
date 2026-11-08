import { useQuery } from '@tanstack/react-query';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { getReport } from '@/src/services/reports';
import { colors } from '@/src/theme/colors';
import type { ReportSummary } from '@/src/types/database';

export default function ReportScreen() {
  const query = useQuery({
    queryKey: ['report'],
    queryFn: getReport,
  });

  return (
    <Screen tab refreshable showBack>
      <ScreenTitle title="Relatório" subtitle="Viagens encerradas nos últimos 30 dias" />
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? (
        <ErrorState
          message={
            query.error instanceof Error && /404/.test(query.error.message)
              ? 'O relatório fica disponível depois de atualizar o servidor.'
              : 'Não foi possível montar o relatório.'
          }
        />
      ) : null}
      {query.data ? (
        <Button
          label="Compartilhar"
          variant="secondary"
          onPress={() => void Share.share({ message: reportText(query.data!) })}
        />
      ) : null}
      {query.data ? (
        <View style={styles.summary}>
          <Stat label="Viagens" value={String(query.data.trips)} />
          <Stat label="Embarques" value={String(query.data.boarded)} />
          <Stat label="Ausências" value={String(query.data.absences)} />
        </View>
      ) : null}
      {query.data?.rows.length === 0 ? (
        <EmptyState title="Nenhuma viagem encerrada" hint="O resumo aparece quando um trajeto termina." />
      ) : null}
      {query.data?.rows.map((row, index) => (
        <ListRow
          key={`${row.started_at}-${index}`}
          icon="time-outline"
          glyph="📋"
          title={row.route_name}
          subtitle={`${when(row.started_at)} · ${row.boarded} embarque(s) · ${row.absent} ausência(s)`}
        />
      ))}
    </Screen>
  );
}

function reportText(data: ReportSummary) {
  const lines = [
    'EmbarqueAI — últimos 30 dias',
    `Viagens: ${data.trips}`,
    `Embarques: ${data.boarded}`,
    `Ausências: ${data.absences}`,
    '',
    ...data.rows.map(
      (row) =>
        `${when(row.started_at)} · ${row.route_name}: ${row.boarded} embarque(s), ${row.absent} ausência(s)`,
    ),
  ];
  return lines.join('\n');
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function when(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 16 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
  },
  value: { fontSize: 22, fontWeight: '800', color: colors.ink },
  label: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
});
