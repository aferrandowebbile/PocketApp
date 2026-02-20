import React from "react";
import { Text } from "react-native";
import { Card } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";

export function UnsupportedSection() {
  const { theme } = useTheme();

  return (
    <Card>
      <Text className="font-inter-medium text-[16px]" style={{ color: theme.colors.text }}>
        This section is not supported yet.
      </Text>
    </Card>
  );
}
