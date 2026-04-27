import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SecurityChecklistState {
  items: Record<string, boolean>;
  updated_by: string | null;
  updated_at: string | null;
}

const DEFAULT_STATE: SecurityChecklistState = {
  items: {},
  updated_by: null,
  updated_at: null,
};

/**
 * Sdílený stav Security Hardening Checklistu mezi administrátory.
 *
 * Ukládá se do system_settings (key = 'security_checklist_state').
 * Pouze admin má RLS přístup k UPDATE/INSERT (editace probíhá přes admin RLS
 * na tabulce system_settings, viz existující politiky).
 *
 * Fallback: pokud DB volání selže (oprávnění, offline), použije se localStorage,
 * aby se admin nezasekl bez UI funkcionality.
 */
const STORAGE_KEY = "security-checklist-state-v1";

export function useSecurityChecklistState() {
  const [state, setState] = useState<SecurityChecklistState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  // Initial load: DB → fallback localStorage
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "security_checklist_state")
          .maybeSingle();
        if (cancelled) return;
        const v = (data?.value ?? null) as Partial<SecurityChecklistState> | null;
        if (v && typeof v === "object") {
          setState({ ...DEFAULT_STATE, ...v, items: { ...(v.items ?? {}) } });
        } else {
          // Fallback to legacy localStorage entries
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setState({ ...DEFAULT_STATE, items: JSON.parse(raw) });
          } catch {
            /* ignore */
          }
        }
      } catch {
        // ignore — keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (id: string) => {
      const nextItems = { ...state.items, [id]: !state.items[id] };
      const { data: userData } = await supabase.auth.getUser();
      const next: SecurityChecklistState = {
        items: nextItems,
        updated_by: userData?.user?.email ?? userData?.user?.id ?? null,
        updated_at: new Date().toISOString(),
      };
      setState(next);

      // Persist to localStorage immediately as a fallback
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
      } catch {
        /* ignore */
      }

      // Persist to DB (admin-only via RLS). Errors silently ignored —
      // checkbox stays toggled locally even if the user lacks permission.
      try {
        await supabase
          .from("system_settings")
          .update({ value: next as any })
          .eq("key", "security_checklist_state");
      } catch (e) {
        console.warn("[useSecurityChecklistState] DB update failed:", e);
      }
    },
    [state.items],
  );

  return { state, toggle, loading };
}
