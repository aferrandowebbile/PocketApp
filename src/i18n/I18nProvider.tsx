import React from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { useRTL } from "@/i18n/useRTL";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useRTL();
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
