export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
}

/** Soma dias a uma data AAAA-MM-DD (sem depender do fuso do aparelho). */
export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Dia da semana de uma data AAAA-MM-DD (0 = domingo). */
export function weekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** "sex., 14/11" */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(`${day}T12:00:00Z`));
}

/** Próximos dias úteis (seg–sex) a partir de amanhã. */
export function nextWeekdays(from: string, count: number): string[] {
  const days: string[] = [];
  let cursor = from;
  while (days.length < count) {
    cursor = addDays(cursor, 1);
    const wd = weekday(cursor);
    if (wd !== 0 && wd !== 6) days.push(cursor);
  }
  return days;
}
