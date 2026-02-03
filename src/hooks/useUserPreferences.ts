import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserPreferences {
  // UI & Display
  theme: "light" | "dark" | "system";
  compactMode: boolean;
  itemsPerPage: number;
  showExpiredFirst: boolean;
  animationsEnabled: boolean;
  
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
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  compactMode: false,
  itemsPerPage: 25,
  showExpiredFirst: true,
  animationsEnabled: true,
  soundEnabled: false,
  desktopNotifications: false,
  showStatusBadges: true,
  highlightUrgent: true,
  defaultView: "table",
  showQuickStats: true,
  autoRefresh: false,
  autoRefreshInterval: 60,
};

const getStorageKey = (userId: string | null) => {
  return userId ? `userPreferences_${userId}` : "userPreferences_anonymous";
};

export function useUserPreferences() {
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Get current user ID on mount and auth changes
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);
    };

    getCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load preferences when userId changes
  useEffect(() => {
    if (userId === null && !isLoaded) {
      // Wait for auth to initialize
      return;
    }

    const storageKey = getStorageKey(userId);
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
  }, [userId]);

  // Apply theme effect with smooth transition
  useEffect(() => {
    if (!isLoaded) return;
    
    const root = document.documentElement;
    
    // Determine if dark mode should be applied
    const shouldBeDark = preferences.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : preferences.theme === "dark";
    
    // Apply the theme change
    root.classList.toggle("dark", shouldBeDark);
  }, [preferences.theme, isLoaded]);

  // Listen for system theme changes
  useEffect(() => {
    if (preferences.theme !== "system") return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [preferences.theme]);

  // Disable transitions on initial load to prevent flash
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("no-transitions");
    
    // Re-enable transitions after initial render
    const timeout = setTimeout(() => {
      root.classList.remove("no-transitions");
    }, 100);
    
    return () => clearTimeout(timeout);
  }, []);

  // Apply compact mode
  useEffect(() => {
    if (!isLoaded) return;
    document.documentElement.classList.toggle("compact-mode", preferences.compactMode);
  }, [preferences.compactMode, isLoaded]);

  // Apply animations setting
  useEffect(() => {
    if (!isLoaded) return;
    document.documentElement.classList.toggle("no-animations", !preferences.animationsEnabled);
  }, [preferences.animationsEnabled, isLoaded]);

  // Save preferences
  const savePreferences = useCallback((newPrefs: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPrefs };
      try {
        const storageKey = getStorageKey(userId);
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save preferences:", e);
      }
      return updated;
    });
  }, [userId]);

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
