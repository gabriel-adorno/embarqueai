/** Placas brasileiras: padrão antigo (ABC1234) e Mercosul (ABC1D23). */
const PLATE = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

/** Maiúsculas, só letras e números: "abc-1234" → "ABC1234". */
export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidPlate(raw: string): boolean {
  return PLATE.test(normalizePlate(raw));
}

/** Exibição: placa antiga com hífen (ABC-1234); Mercosul sem (ABC1D23). */
export function formatPlate(raw: string | null | undefined): string {
  if (!raw) return '';
  const plate = normalizePlate(raw);
  return /^[A-Z]{3}\d{4}$/.test(plate) ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
}

export const PLATE_ERROR = 'Placa inválida. Use o formato ABC-1234 ou ABC1D23.';
export const PLATE_TAKEN = 'Você já tem um veículo com essa placa.';
