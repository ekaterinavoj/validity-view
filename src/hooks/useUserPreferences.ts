import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserPreferences {
  // UI & Display
  theme: "light" | "dark" | "system";
  compactMode: boolean;
  itemsPerPage: number;
  showExpiredFirst: boolean;
  animationsEnabled: boolean;

  // PDF Preview
  pdfViewMode: "single" | "scroll";

  // Notifications
  soundEnabled: boolean;
  desktopNotifications: boolean;
  showStatusBadges: boolean;
  highlightUrgent: boolean;

  // Dashboard
  defaultView: "table" | "cards";
  showQuickStats: boolean;
  autoRefresh: boolean;
  autoRefreshInterval: number; // in seconds

  // Page-specific (synced cross-device)
  probationsCompactMode: boolean; // /probations: hide history tab entirely (no audit query)
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  compactMode: false,
  itemsPerPage: 25,
  showExpiredFirst: true,
  animationsEnabled: true,
  pdfViewMode: "scroll",
  soundEnabled: false,
  desktopNotifications: false,
  showStatusBadges: true,
  highlightUrgent: true,
  defaultView: "table",
  showQuickStats: true,
  autoRefresh: false,
  autoRefreshInterval: 60,
  probationsCompactMode: false,
};

const getStorageKey = (userId: string | null) => {
  return userId ? `userPreferences_${userId}` : "userPreferences_anonymous";
};

export function useUserPreferences() {
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);
  // Avoid persisting back to DB while we are still hydrating from DB
  const isHydratingRef = useRef(true);
  // Debounce DB writes
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get current user ID on mount and auth changes
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);
    };

    getCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load preferences when userId changes:
  // 1) hydrate immediately from localStorage (fast, prevents UI flash)
  // 2) then fetch the DB row and merge — DB is the source of truth across devices
  useEffect(() => {
    if (userId === null && !isLoaded) {
      // Wait for auth to initialize (anonymous case still resolves below)
      return;
    }

    isHydratingRef.current = true;
    const storageKey = getStorageKey(userId);

    // 1) localStorage cache
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
      } else {
        setPreferences(DEFAULT_PREFERENCES);
      }
    } catch (e) {
      console.error("Failed to load user preferences:", e);
      setPreferences(DEFAULT_PREFERENCES);
    }
    setIsLoaded(true);

    // 2) DB sync (only for authenticated users)
    if (!userId) {
      isHydratingRef.current = false;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("preferences")
          .eq("user_id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.warn("[useUserPreferences] DB fetch failed, using localStorage only:", error.message);
        } else if (data?.preferences && typeof data.preferences === "object") {
          const merged = { ...DEFAULT_PREFERENCES, ...(data.preferences as Partial<UserPreferences>) };
          setPreferences(merged);
          try {
            localStorage.setItem(storageKey, JSON.stringify(merged));
          } catch {/* ignore */}
        }
      } finally {
        if (!cancelled) isHydratingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Apply theme effect with smooth transition
  useEffect(() => {
    if (!isLoaded) return;

    const root = document.documentElement;
    const shouldBeDark = preferences.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : preferences.theme === "dark";
    root.classList.toggle("dark", shouldBeDark);
  }, [preferences.theme, isLoaded]);

  useEffect(() => {
    if (preferences.theme !== "system") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [preferences.theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("no-transitions");
    const timeout = setTimeout(() => {
      root.classList.remove("no-transitions");
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    document.documentElement.classList.toggle("compact-mode", preferences.compactMode);
  }, [preferences.compactMode, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    document.documentElement.classList.toggle("no-animations", !preferences.animationsEnabled);
  }, [preferences.animationsEnabled, isLoaded]);

  // Persist preferences whenever they change: localStorage immediately, DB debounced.
  useEffect(() => {
    if (!isLoaded || isHydratingRef.current) return;
    const storageKey = getStorageKey(userId);
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch (e) {
      console.error("Failed to persist preferences to localStorage:", e);
    }
    if (!userId) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { error } = await (supabase
        .from("user_preferences") as any)
        .upsert(
          { user_id: userId, preferences: preferences as unknown as Record<string, unknown> },
          { onConflict: "user_id" },
        );
      if (error) {
        console.warn("[useUserPreferences] DB upsert failed:", error.message);
      }
    }, 500);
  }, [preferences, userId, isLoaded]);

  // Save preferences (state update only — persistence is handled by the effect above)
  const savePreferences = useCallback((newPrefs: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...newPrefs }));
  }, []);

  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    savePreferences({ [key]: value });
  }, [savePreferences]);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      const storageKey = getStorageKey(userId);
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error("Failed to reset preferences:", e);
    }
  }, [userId]);

  return {
    preferences,
    updatePreference,
    savePreferences,
    resetPreferences,
    DEFAULT_PREFERENCES,
    isLoaded,
  };
}
