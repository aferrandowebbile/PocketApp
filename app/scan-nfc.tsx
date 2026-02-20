import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";

type ParsedRow = { key: string; value: string };
type NfcRuntime = {
  manager: {
    start: () => Promise<void>;
    isSupported: () => Promise<boolean>;
    isEnabled: () => Promise<boolean>;
    requestTechnology: (tech: unknown, options?: { alertMessage?: string }) => Promise<unknown>;
    getTag: () => Promise<any>;
    cancelTechnologyRequest: () => Promise<void>;
    goToNfcSetting: () => Promise<boolean>;
  };
  Ndef: any;
  NfcTech: { Ndef: unknown };
};

let runtimeCache: NfcRuntime | null = null;

function isExpoGoRuntime(): boolean {
  return Constants.appOwnership === "expo";
}

async function getNfcRuntime(): Promise<NfcRuntime> {
  if (runtimeCache) return runtimeCache;

  const mod = await import("react-native-nfc-manager");
  runtimeCache = {
    manager: mod.default as NfcRuntime["manager"],
    Ndef: (mod as any).Ndef,
    NfcTech: (mod as any).NfcTech
  };
  return runtimeCache;
}

function decodeRecordType(record: any): string {
  if (typeof record?.type === "string") return record.type;
  if (Array.isArray(record?.type)) {
    return record.type.map((value: number) => String.fromCharCode(value)).join("");
  }
  return "unknown";
}

function decodeRecordPayload(record: any, ndef: any): string {
  const payload = Uint8Array.from(record?.payload ?? []);

  try {
    if (ndef.isType(record, ndef.TNF_WELL_KNOWN, ndef.RTD_TEXT)) {
      return ndef.text.decodePayload(payload);
    }

    if (ndef.isType(record, ndef.TNF_WELL_KNOWN, ndef.RTD_URI)) {
      return ndef.uri.decodePayload(payload);
    }
  } catch {
    // Fallback to raw hex string below.
  }

  return ndef.util.bytesToHexString(payload);
}

function parseTag(tag: any, ndef: any): ParsedRow[] {
  const rows: ParsedRow[] = [];

  if (tag?.id) rows.push({ key: "Tag ID", value: String(tag.id) });
  if (tag?.type) rows.push({ key: "Tag Type", value: String(tag.type) });
  if (Array.isArray(tag?.techTypes) && tag.techTypes.length) {
    rows.push({ key: "Tech", value: tag.techTypes.join(", ") });
  }

  if (Array.isArray(tag?.ndefMessage) && tag.ndefMessage.length) {
    tag.ndefMessage.forEach((record: any, index: number) => {
      rows.push({ key: `Record ${index + 1} Type`, value: decodeRecordType(record) });
      rows.push({ key: `Record ${index + 1} Payload`, value: decodeRecordPayload(record, ndef) });
    });
  }

  return rows;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "NFC scan failed.";
}

export default function ScanNfcScreen() {
  const [supported, setSupported] = React.useState<boolean | null>(null);
  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tag, setTag] = React.useState<any | null>(null);
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [rawOpen, setRawOpen] = React.useState(false);

  const refreshStatus = React.useCallback(async () => {
    if (isExpoGoRuntime()) {
      setSupported(false);
      setEnabled(false);
      return;
    }

    const nfc = await getNfcRuntime();
    const isSupported = await nfc.manager.isSupported();
    setSupported(isSupported);
    if (!isSupported) {
      setEnabled(false);
      return;
    }

    const isEnabled = await nfc.manager.isEnabled();
    setEnabled(isEnabled);
  }, []);

  React.useEffect(() => {
    let active = true;

    async function setup() {
      try {
        if (isExpoGoRuntime()) {
          setSupported(false);
          setEnabled(false);
          return;
        }

        const nfc = await getNfcRuntime();
        await nfc.manager.start();
        if (!active) return;
        await refreshStatus();
      } catch (setupError) {
        if (active) {
          setError(toErrorMessage(setupError));
          setSupported(false);
        }
      }
    }

    setup().catch(() => undefined);

    return () => {
      active = false;
      getNfcRuntime()
        .then((nfc) => nfc.manager.cancelTechnologyRequest().catch(() => undefined))
        .catch(() => undefined);
    };
  }, [refreshStatus]);

  const startScan = async () => {
    if (scanning) return;

    if (isExpoGoRuntime()) {
      setError("NFC requires a Development Build (not Expo Go).");
      return;
    }

    setError(null);
    setTag(null);
    setRows([]);
    setRawOpen(false);
    setScanning(true);

    try {
      const nfc = await getNfcRuntime();
      await nfc.manager.requestTechnology(nfc.NfcTech.Ndef, {
        alertMessage: "Hold your device near the NFC ticket"
      });

      const detectedTag = await nfc.manager.getTag();
      if (!detectedTag) {
        setError("No NFC tag detected.");
        return;
      }

      setTag(detectedTag);
      setRows(parseTag(detectedTag, nfc.Ndef));
    } catch (scanError) {
      setError(toErrorMessage(scanError));
    } finally {
      const nfc = await getNfcRuntime().catch(() => null);
      await nfc?.manager.cancelTechnologyRequest().catch(() => undefined);
      setScanning(false);
      await refreshStatus().catch(() => undefined);
    }
  };

  const goToSettings = async () => {
    try {
      if (Platform.OS === "android") {
        const nfc = await getNfcRuntime();
        await nfc.manager.goToNfcSetting();
      }
      await refreshStatus();
    } catch (settingsError) {
      setError(toErrorMessage(settingsError));
    }
  };

  return (
    <AppShell title="Scan NFC">
      <Pressable
        style={styles.back}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }
          router.replace("/(tabs)/home");
        }}
      >
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <Card title="NFC Reader" subtitle="Tap Start NFC Scan, then place the phone near the tag." />

      {isExpoGoRuntime() ? <Text style={styles.error}>NFC is unavailable in Expo Go. Use a Development Build.</Text> : null}
      {supported === false && !isExpoGoRuntime() ? <Text style={styles.error}>NFC is not supported on this device.</Text> : null}
      {enabled === false && !isExpoGoRuntime() ? <Text style={styles.error}>NFC is disabled on this device.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton
          label={scanning ? "Scanning..." : "Start NFC Scan"}
          onPress={startScan}
          disabled={scanning || !supported || !enabled || isExpoGoRuntime()}
        />
        {enabled === false && !isExpoGoRuntime() ? <PrimaryButton label="Open NFC settings" onPress={goToSettings} /> : null}
      </View>

      {tag ? (
        <ScrollView style={styles.results}>
          <Card title="Detected Format" subtitle={Array.isArray(tag?.ndefMessage) && tag.ndefMessage.length ? "NDEF" : "Raw Tag"} />
          {rows.map((row) => (
            <Card key={`${row.key}:${row.value}`} title={row.key} subtitle={row.value} />
          ))}

          <View style={styles.accordionWrap}>
            <Pressable style={styles.accordionHeader} onPress={() => setRawOpen((prev) => !prev)}>
              <Text style={styles.accordionTitle}>Raw Payload (JSON)</Text>
              <Text style={styles.accordionChevron}>{rawOpen ? "▲" : "▼"}</Text>
            </Pressable>
            {rawOpen ? <Card title="Tag JSON" subtitle={JSON.stringify(tag, null, 2)} /> : null}
          </View>
        </ScrollView>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ffd7ef",
    backgroundColor: "#fff7fc"
  },
  backLabel: {
    color: "#a72678",
    fontWeight: "700"
  },
  actions: {
    gap: 8,
    marginBottom: 12
  },
  results: {
    marginTop: 2
  },
  error: {
    color: theme.colors.danger,
    marginBottom: 8
  },
  accordionWrap: {
    marginBottom: 12
  },
  accordionHeader: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  accordionTitle: {
    color: theme.colors.text,
    fontWeight: "700"
  },
  accordionChevron: {
    color: theme.colors.mutedText,
    fontWeight: "700"
  }
});
