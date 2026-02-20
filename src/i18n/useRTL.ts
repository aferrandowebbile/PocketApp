import { useEffect } from "react";
import { I18nManager } from "react-native";
import i18n from "@/i18n";

export function useRTL() {
  useEffect(() => {
    const applyDirection = () => {
      const shouldBeRTL = i18n.language === "ar";
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
      }
    };

    applyDirection();
    i18n.on("languageChanged", applyDirection);

    return () => {
      i18n.off("languageChanged", applyDirection);
    };
  }, []);
}
