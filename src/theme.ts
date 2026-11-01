import { useSettings } from '@/settings/SettingsContext';

export interface Theme {
  background: string;
  card: string;
  surfaceRaised: string;
  divider: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  tint: string;
  buttonPrimary: string;
  buttonSecondary: string;
  buttonDanger: string;
  danger: string;
  success: string;
  warning: string;
  statusBar: 'light-content' | 'dark-content';
  userBubble: string;
  userBubbleText: string;
  assistantBubble: string;
  inputBackground: string;
}

const light: Theme = {
  background: '#F3F7F2',
  card: '#FFFFFF',
  surfaceRaised: '#E8F0E8',
  divider: '#DFE8DF',
  text: '#17261B',
  textSecondary: '#526657',
  muted: '#748477',
  border: '#D5E1D6',
  tint: '#347A4B',
  buttonPrimary: '#347A4B',
  buttonSecondary: '#E5EEE5',
  buttonDanger: '#B5483F',
  danger: '#B5483F',
  success: '#347A4B',
  warning: '#8A6500',
  statusBar: 'dark-content',
  userBubble: '#347A4B',
  userBubbleText: '#F2FFF2',
  assistantBubble: '#E8F0E8',
  inputBackground: '#FFFFFF',
};

const dark: Theme = {
  background: '#050806',
  card: 'rgba(15, 39, 27, 0.96)',
  surfaceRaised: 'rgba(35, 72, 48, 0.88)',
  divider: 'rgba(147, 190, 151, 0.18)',
  text: '#EDF5EC',
  textSecondary: '#A4BAA8',
  muted: '#78917E',
  border: 'rgba(137, 183, 143, 0.22)',
  tint: '#80C98A',
  buttonPrimary: '#347A4B',
  buttonSecondary: 'rgba(35, 72, 48, 0.88)',
  buttonDanger: '#873E36',
  danger: '#F08B7D',
  success: '#80C98A',
  warning: '#BBCB79',
  statusBar: 'light-content',
  userBubble: '#286441',
  userBubbleText: '#F2FFF2',
  assistantBubble: 'rgba(17, 43, 30, 0.94)',
  inputBackground: 'rgba(12, 34, 23, 0.96)',
};

export function useTheme(): Theme {
  return useSettings().settings.theme === 'dark' ? dark : light;
}
