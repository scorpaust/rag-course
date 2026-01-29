/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Color palette for the theme
 */
export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  text: string;
  textSecondary: string;
  border: string;
  code: string;
  userMessage: string;
  aiMessage: string;
  citation: string;
  warning: string;
  error: string;
}

/**
 * Typography settings for the theme
 */
export interface ThemeTypography {
  fontFamily: string;
  codeFontFamily: string;
  baseFontSize: string;
  lineHeight: number;
}

/**
 * Complete theme configuration
 */
export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  typography: ThemeTypography;
}
