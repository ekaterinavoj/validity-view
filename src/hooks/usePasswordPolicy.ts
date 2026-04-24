import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PASSWORD_POLICY, type PasswordPolicy } from "@/lib/passwordStrength";

/**
 * Loads `password_policy` from system_settings. Falls back to defaults while loading
 * or on error so UI never breaks. Authenticated users have a dedicated RLS policy
 * permitting SELECT on the password_policy row.
 */
export function usePasswordPolicy(): { policy: PasswordPolicy; loading: boolean } {
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "password_policy")
          .maybeSingle();
        if (cancelled) return;
        const v = (data?.value ?? null) as Partial<PasswordPolicy> | null;
        if (v) setPolicy({ ...DEFAULT_PASSWORD_POLICY, ...v });
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

  return { policy, loading };
}
