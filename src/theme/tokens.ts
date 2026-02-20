export type ThemeTokenInput = {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
};

export type AppTheme = {
  colors: ThemeTokenInput;
  radius: {
    lg: number;
    xl: number;
    xxl: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  typeScale: {
    display: number;
    h1: number;
    h2: number;
    body: number;
    small: number;
  };
};

const baseTheme = {
  radius: {
    lg: 16,
    xl: 20,
    xxl: 24
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24
  },
  typeScale: {
    display: 30,
    h1: 24,
    h2: 20,
    body: 16,
    small: 14
  }
};

export const lightTokens: ThemeTokenInput = {
  primary: "#0F62FE",
  secondary: "#14B8A6",
  background: "#F7F9FC",
  surface: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626"
};

export const darkTokens: ThemeTokenInput = {
  primary: "#5EA8FF",
  secondary: "#2DD4BF",
  background: "#090D16",
  surface: "#111827",
  text: "#E2E8F0",
  muted: "#94A3B8",
  border: "#1E293B",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444"
};

export const buildTheme = (isDark: boolean, overrides?: Partial<ThemeTokenInput>): AppTheme => ({
  ...baseTheme,
  colors: {
    ...(isDark ? darkTokens : lightTokens),
    ...(overrides ?? {})
  }
});
