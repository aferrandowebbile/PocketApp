import type { RemoteGuest } from "@/services/guestsClient";

const guestsMap = new Map<string, RemoteGuest>();

export function cacheGuest(guest: RemoteGuest): void {
  guestsMap.set(guest.id, guest);
}

export function getCachedGuest(guestId: string): RemoteGuest | null {
  return guestsMap.get(guestId) ?? null;
}
