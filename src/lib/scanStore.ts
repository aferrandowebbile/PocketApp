import AsyncStorage from "@react-native-async-storage/async-storage";

export type LocalScanRecord = {
  id: string;
  scannedAt: string;
  rawValue: string;
  scanTypeLabel: string | null;
  parsedType: "json" | "url" | "text" | "unknown";
  validationStatus: "validated" | "error" | "redeemed";
  validationMessage: string;
  orderId: string | null;
  guestName: string | null;
  product: string | null;
  orderStatus: string | null;
  ticketCount: number | null;
};

const STORAGE_KEY = "spotlio.scanHistory.v1";
const MAX_ITEMS = 100;

let cache: LocalScanRecord[] | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function normalizeRecords(records: LocalScanRecord[]): LocalScanRecord[] {
  return records
    .slice()
    .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime())
    .slice(0, MAX_ITEMS);
}

async function persist(records: LocalScanRecord[]) {
  cache = normalizeRecords(records);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  emitChange();
}

export async function getScanHistory(): Promise<LocalScanRecord[]> {
  if (cache) return cache;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    cache = [];
    return cache;
  }

  try {
    const parsed = JSON.parse(raw) as LocalScanRecord[];
    cache = normalizeRecords(Array.isArray(parsed) ? parsed : []);
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

export async function appendScanHistory(record: Omit<LocalScanRecord, "id">): Promise<LocalScanRecord> {
  const nextRecord: LocalScanRecord = {
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  };
  const current = await getScanHistory();
  await persist([nextRecord, ...current]);
  return nextRecord;
}

export async function clearScanHistory(): Promise<void> {
  await persist([]);
}

export function subscribeToScanHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
