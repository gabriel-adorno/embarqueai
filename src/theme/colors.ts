import { Appearance } from 'react-native';

/**
 * Paleta clara e escura. O tema é escolhido quando o app abre, conforme o
 * aparelho (os estilos são criados uma vez). Se o usuário trocar o tema do
 * sistema com o app aberto, a mudança aparece na próxima abertura.
 */
const light = {
  primary: '#2B6CB0',
  primaryDark: '#163A6B',
  primaryMid: '#3A86C8',
  accent: '#5EEAD4',
  background: '#F3F7FB',
  surface: '#EEF4FA',
  /** Fundo de cartões, campos e folhas (branco no claro). */
  card: '#FFFFFF',
  ink: '#0E2A47',
  text: '#0E2A47',
  textMuted: '#5B7390',
  textSecondary: '#5B7390',
  border: '#D5E4F2',
  inputBorder: '#D5E4F2',
  inputFocus: '#2B6CB0',
  placeholder: '#8AA0B8',
  label: '#0E2A47',
  link: '#2B6CB0',
  error: '#D32F2F',
  errorBg: '#FFF5F5',
  success: '#0E8345',
  successBg: '#E8F5EE',
  danger: '#D32F2F',
  overlay: 'rgba(14, 42, 71, 0.5)',
  /** Branco de verdade: texto e ícones sobre azul/vermelho. */
  white: '#FFFFFF',
  cardBorder: '#E2EEF8',
  iconBg: '#E4F0FB',
  live: '#12B981',
  tabInk: '#12151A',
  tabMuted: '#6B7280',
  /** Aba ativa e faixas de destaque escuras. */
  strongBg: '#12151A',
  strongFg: '#FFFFFF',
  /** Vidro translúcido (barra de abas, painéis sobre o mapa). */
  glass: 'rgba(255,255,255,0.92)',
  glassSoft: 'rgba(255,255,255,0.78)',
  /** Bordas finas e alça das folhas. */
  hairline: 'rgba(18, 21, 26, 0.08)',
  handle: 'rgba(18, 21, 26, 0.14)',
  mapBackground: '#f4f4f2',
};

type Palette = { [K in keyof typeof light]: string };

const dark: Palette = {
  primary: '#4A90D9',
  primaryDark: '#0A1A2E',
  primaryMid: '#5AA0DE',
  accent: '#5EEAD4',
  background: '#0B1420',
  surface: '#122030',
  card: '#172638',
  ink: '#E6EEF7',
  text: '#E6EEF7',
  textMuted: '#93A7BF',
  textSecondary: '#93A7BF',
  border: '#28405A',
  inputBorder: '#28405A',
  inputFocus: '#4A90D9',
  placeholder: '#6F86A0',
  label: '#E6EEF7',
  link: '#7FB3EA',
  error: '#FF6B6B',
  errorBg: '#3A1A1D',
  success: '#3DD68C',
  successBg: '#12301F',
  danger: '#FF6B6B',
  overlay: 'rgba(0, 0, 0, 0.6)',
  white: '#FFFFFF',
  cardBorder: '#22364B',
  iconBg: '#1C3046',
  live: '#22C98E',
  tabInk: '#E6EEF7',
  tabMuted: '#93A0B0',
  strongBg: '#E6EEF7',
  strongFg: '#0B1420',
  glass: 'rgba(23,38,56,0.94)',
  glassSoft: 'rgba(23,38,56,0.86)',
  hairline: 'rgba(255,255,255,0.08)',
  handle: 'rgba(255,255,255,0.22)',
  mapBackground: '#1b2430',
};

export const isDark = Appearance.getColorScheme() === 'dark';

export const colors: Palette = isDark ? dark : light;
