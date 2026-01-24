import { useEffect } from "react";
import { useUserPreferences } from "@/hooks/useUserPreferences";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Initialize user preferences - this will apply theme, compact mode, etc.
  useUserPreferences();
  
  return <>{children}</>;
}
