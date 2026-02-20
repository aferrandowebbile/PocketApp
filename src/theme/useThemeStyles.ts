import { useMemo } from "react";
import { useTheme } from "@/theme/ThemeProvider";

export function useThemeStyles() {
  const { theme, isDark } = useTheme();

  return useMemo(
    () => ({
      cardStyle: {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border
      },
      backgroundStyle: {
        backgroundColor: theme.colors.background
      },
      textStyle: {
        color: theme.colors.text
      },
      mutedTextStyle: {
        color: theme.colors.muted
      },
      isDark
    }),
    [theme, isDark]
  );
}
