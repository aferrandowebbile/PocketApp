import i18n from "i18next";
import { initReactI18next } from "react-i18next";

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      common: {
        home: "Home",
        map: "Map",
        inbox: "Inbox",
        account: "Account",
        noNotifications: "No notifications yet"
      }
    },
    es: {
      common: {
        home: "Inicio",
        map: "Mapa",
        inbox: "Bandeja",
        account: "Cuenta",
        noNotifications: "No hay notificaciones"
      }
    },
    ar: {
      common: {
        home: "الرئيسية",
        map: "الخريطة",
        inbox: "الوارد",
        account: "الحساب",
        noNotifications: "لا توجد إشعارات"
      }
    }
  },
  ns: ["common"],
  defaultNS: "common",
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
