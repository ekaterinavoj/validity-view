import { useState, useEffect, useCallback } from "react";

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

const STORAGE_KEY = "userPreferences";

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error("Failed to load user preferences:", e);
    }
    return DEFAULT_PREFERENCES;
  });

  // Apply theme effect with smooth transition
  useEffect(() => {
    const root = document.documentElement;
    
    // Determine if dark mode should be applied
    const shouldBeDark = preferences.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : preferences.theme === "dark";
    
    // Apply the theme change
    root.classList.toggle("dark", shouldBeDark);
  }, [preferences.theme]);

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
    document.documentElement.classList.toggle("compact-mode", preferences.compactMode);
  }, [preferences.compactMode]);

  // Apply animations setting
  useEffect(() => {
    document.documentElement.classList.toggle("no-animations", !preferences.animationsEnabled);
  }, [preferences.animationsEnabled]);

  // Save preferences
  const savePreferences = useCallback((newPrefs: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPrefs };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save preferences:", e);
      }
      return updated;
    });
  }, []);

  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    savePreferences({ [key]: value });
  }, [savePreferences]);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    preferences,
    updatePreference,
    savePreferences,
    resetPreferences,
    DEFAULT_PREFERENCES,
  };
}
