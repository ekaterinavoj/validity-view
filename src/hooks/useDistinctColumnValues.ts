import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches the distinct, non-empty values already used in a text column of a table —
 * feeds SuggestedTextInput so fields like "company"/"doctor"/"medical facility" (external
 * entities with no dedicated table of their own) offer autocomplete from real history
 * instead of every form starting from a blank slate.
 *
 * PostgREST has no native DISTINCT, so this fetches the column (capped, most recent
 * first) and dedupes client-side — fine at the row counts these tables realistically
 * reach; revisit with an RPC if that ever stops being true.
 */
export function useDistinctColumnValues(table: string, column: string): string[] {
  const [values, setValues] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from(table as never)
        .select(column)
        .not(column, "is", null)
        .order(column, { ascending: true })
        .limit(2000);

      if (error || !data || cancelled) return;

      const seen = new Set<string>();
      for (const row of data as unknown as Record<string, string | null>[]) {
        const v = row[column]?.trim();
        if (v) seen.add(v);
      }
      setValues(Array.from(seen).sort((a, b) => a.localeCompare(b, "cs")));
    })();
    return () => {
      cancelled = true;
    };
  }, [table, column]);

  return values;
}
