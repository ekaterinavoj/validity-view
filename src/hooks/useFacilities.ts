import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Facility {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useFacilities() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFacilities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("facilities")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (fetchError) throw fetchError;

      setFacilities(data || []);
    } catch (err: any) {
      console.error("Error fetching facilities:", err);
      setError("Nepodařilo se načíst provozovny. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  return { facilities, loading, error, refetch: fetchFacilities };
}
