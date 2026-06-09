import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  directusConfigError,
  hydrateDirectusSessionFromMe,
  isDirectusConfigured,
  restoreDirectusSession,
  signInDirectus,
  signOutDirectus,
  updateSelectedSite,
  type DirectusSession,
  type DirectusSite
} from "@/lib/directusAuth";
import type { Profile } from "@/types/domain";

type AuthUser = DirectusSession["user"];

type AuthContextValue = {
  user: AuthUser | null;
  session: DirectusSession | null;
  profile: Profile | null;
  sites: DirectusSite[];
  selectedSite: DirectusSite | null;
  selectedSiteAlias: string | null;
  selectedSiteApiToken: string | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  selectSite: (alias: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<DirectusSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sites, setSites] = useState<DirectusSite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!isDirectusConfigured) {
        if (active) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setSites([]);
        }
        return;
      }

      const restored = await restoreDirectusSession();
      if (!active) return;

      if (!restored) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setSites([]);
        return;
      }

      setSession(restored.session);
      setUser(restored.session.user);
      setProfile(restored.profile);
      setSites(restored.sites);

      const hydrated = await hydrateDirectusSessionFromMe(restored).catch(() => restored);
      if (!active) return;
      setSession(hydrated.session);
      setUser(hydrated.session.user);
      setProfile(hydrated.profile);
      setSites(hydrated.sites);
    };

    const loadingGuard = setTimeout(() => {
      if (active) setLoading(false);
    }, 4000);

    bootstrap()
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(loadingGuard);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      sites,
      selectedSite: sites.find((site) => site.alias === session?.selectedSiteAlias) ?? null,
      selectedSiteAlias: session?.selectedSiteAlias ?? null,
      selectedSiteApiToken: session?.selectedSiteApiToken ?? null,
      loading,
      signInWithPassword: async (email: string, password: string) => {
        if (!isDirectusConfigured) {
          throw new Error(directusConfigError ?? "Directus is not configured");
        }
        const signed = await signInDirectus(email, password);
        setSession(signed.session);
        setUser(signed.session.user);
        setProfile(signed.profile);
        setSites(signed.sites);
      },
      signInWithGoogle: async () => {
        throw new Error("Google sign-in is not configured for Directus in this app.");
      },
      signOut: async () => {
        await signOutDirectus();
        setSession(null);
        setUser(null);
        setProfile(null);
        setSites([]);
      },
      refreshProfile: async () => {
        const restored = await restoreDirectusSession();
        if (!restored) return;
        setProfile(restored.profile);
        setSites(restored.sites);
      },
      selectSite: async (alias: string) => {
        const target = sites.find((site) => site.alias === alias);
        if (!target) throw new Error("Site alias not found.");
        const updated = await updateSelectedSite(target);
        if (!updated) throw new Error("No active session to update site.");
        setSession(updated.session);
        setUser(updated.session.user);
        setProfile(updated.profile);
        setSites(updated.sites);
      }
    }),
    [user, session, profile, sites, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
