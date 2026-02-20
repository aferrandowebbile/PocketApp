import type { Profile } from "@/types/domain";

const adminCommerceEnabled = process.env.EXPO_PUBLIC_ENABLE_ADMIN_COMMERCE === "true";

export function isViewer(profile: Profile | null): boolean {
  return profile?.role === "viewer";
}

export function canReplyToTickets(profile: Profile | null): boolean {
  return Boolean(profile && profile.role !== "viewer");
}

export function canAccessCommerce(profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.role === "operator") return true;
  if (profile.role === "admin") return adminCommerceEnabled;
  return false;
}
