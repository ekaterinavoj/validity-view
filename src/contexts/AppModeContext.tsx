import { createContext, useContext, useState, ReactNode } from "react";

export type AppMode = "trainings" | "deadlines";

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isTrainingMode: boolean;
  isDeadlineMode: boolean;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem("app-mode");
    return (saved as AppMode) || "trainings";
  });

  const handleSetMode = (newMode: AppMode) => {
    setMode(newMode);
    localStorage.setItem("app-mode", newMode);
  };

  return (
    <AppModeContext.Provider
      value={{
        mode,
        setMode: handleSetMode,
        isTrainingMode: mode === "trainings",
        isDeadlineMode: mode === "deadlines",
      }}
    >
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error("useAppMode must be used within AppModeProvider");
  }
  return context;
}
