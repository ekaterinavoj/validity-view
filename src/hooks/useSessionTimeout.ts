import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SessionTimeoutConfig {
  enabled: boolean;
  idle_minutes: number;
  warn_seconds_before: number;
}

const DEFAULT_CONFIG: SessionTimeoutConfig = {
  enabled: true,
  idle_minutes: 60,
  warn_seconds_before: 300,
};

const STORAGE_KEY = "lhutnik_session_timeout_config_v1";
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];
const REDIRECT_FLAG = "lhutnik_logged_out_idle";

/**
 * Auto-logout after inactivity. Configurable via system_settings.session_timeout.
 * - Resets on any user interaction.
 * - Shows a non-blocking warning toast `warn_seconds_before` seconds before expiry.
 * - On expiry: signOut + redirect to /auth?reason=idle.
 */
export function useSessionTimeout() {
  const { user, signOut } = useAuth();
  const configRef = useRef<SessionTimeoutConfig>(DEFAULT_CONFIG);
  const idleTimerRef = useRef<number | null>(null);
  const warnTimerRef = useRef<number | null>(null);
  const warnedRef = useRef(false);
  const warnToastIdRef = useRef<string | number | null>(null);

  const clearTimers = () => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (warnTimerRef.current) {
      window.clearTimeout(warnTimerRef.current);
      warnTimerRef.current = null;
    }
    if (warnToastIdRef.current !== null) {
      toast.dismiss(warnToastIdRef.current);
      warnToastIdRef.current = null;
    }
    warnedRef.current = false;
  };

  const performLogout = useCallback(async () => {
    clearTimers();
    try {
      sessionStorage.setItem(REDIRECT_FLAG, "1");
    } catch {}
    try {
      await signOut();
    } catch (err) {
      console.warn("Idle signOut failed:", err);
    }
    // Hard redirect ensures we leave any protected route immediately
    window.location.href = "/auth?reason=idle";
  }, [signOut]);

  const armTimers = useCallback(() => {
    if (!configRef.current.enabled) return;
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    if (warnTimerRef.current) window.clearTimeout(warnTimerRef.current);
    if (warnToastIdRef.current !== null) {
      toast.dismiss(warnToastIdRef.current);
      warnToastIdRef.current = null;
    }
    warnedRef.current = false;

    const idleMs = Math.max(1, configRef.current.idle_minutes) * 60_000;
    const warnMs = Math.min(
      Math.max(0, configRef.current.warn_seconds_before) * 1000,
      idleMs - 1000
    );
    const warnAt = idleMs - warnMs;

    if (warnMs > 0) {
      warnTimerRef.current = window.setTimeout(() => {
        if (warnedRef.current) return;
        warnedRef.current = true;
        const minutesLeft = Math.max(1, Math.round(warnMs / 60_000));
        warnToastIdRef.current = toast.warning(
          `Z důvodu neaktivity budete za ${minutesLeft} min odhlášeni.`,
          {
            description: "Klikněte kamkoli nebo použijte tlačítko níže pro prodloužení.",
            duration: warnMs,
            action: {
              label: "Prodloužit přihlášení",
              onClick: () => armTimers(),
            },
          }
        );
      }, warnAt);
    }

    idleTimerRef.current = window.setTimeout(() => {
      void performLogout();
    }, idleMs);
  }, [performLogout]);

  // Load config from cached value first (instant), then refresh from DB.
  useEffect(() => {
    if (!user) {
      clearTimers();
      return;
    }

    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Partial<SessionTimeoutConfig>;
        configRef.current = { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {}

    let cancelled = false;
    void supabase
      .from("system_settings")
      .select("value")
      .eq("key", "session_timeout")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const v = (data?.value ?? null) as Partial<SessionTimeoutConfig> | null;
        if (v && typeof v === "object") {
          const cfg: SessionTimeoutConfig = {
            enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_CONFIG.enabled,
            idle_minutes:
              typeof v.idle_minutes === "number" && v.idle_minutes > 0
                ? v.idle_minutes
                : DEFAULT_CONFIG.idle_minutes,
            warn_seconds_before:
              typeof v.warn_seconds_before === "number" && v.warn_seconds_before >= 0
                ? v.warn_seconds_before
                : DEFAULT_CONFIG.warn_seconds_before,
          };
          configRef.current = cfg;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
          } catch {}
          // Re-arm with fresh config
          armTimers();
        }
      });

    armTimers();

    const onActivity = () => armTimers();
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onActivity, { passive: true })
    );

    const onVisibility = () => {
      if (document.visibilityState === "visible") armTimers();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}

/** Helper to display a one-time toast on /auth when redirected by idle timeout. */
export function consumeIdleLogoutFlag(): boolean {
  try {
    const v = sessionStorage.getItem(REDIRECT_FLAG);
    if (v === "1") {
      sessionStorage.removeItem(REDIRECT_FLAG);
      return true;
    }
  } catch {}
  return false;
}
