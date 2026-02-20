export function canCreateValidation(lastValidatedAt: string | null, now: Date, cooldownMinutes: number): boolean {
  if (!lastValidatedAt) return true;
  const last = new Date(lastValidatedAt).getTime();
  const deltaMs = now.getTime() - last;
  return deltaMs > cooldownMinutes * 60 * 1000;
}
