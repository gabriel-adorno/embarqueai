/** Velocidade média urbana usada quando a API não devolve duração. */
const METERS_PER_MIN = 30_000 / 60;

export function formatEta(
  remainingM: number | null | undefined,
  moving: boolean,
): string {
  if (!moving || remainingM == null) return '—';
  if (remainingM < 80) return 'Chegando';
  const minutes = Math.max(1, Math.round(remainingM / METERS_PER_MIN));
  const arrival = new Date(Date.now() + minutes * 60_000);
  const clock = arrival.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (minutes < 60) return `${minutes} min · ${clock}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h ${rest.toString().padStart(2, '0')} min · ${clock}`;
}
