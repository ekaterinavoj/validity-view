import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MedicalExaminationType {
  id: string;
  name: string;
  facility: string;
  periodDays: number;
  description: string | null;
}

export function useMedicalExaminationTypes() {
  const [examinationTypes, setExaminationTypes] = useState<MedicalExaminationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from("medical_examination_types")
        .select("*")
        .order("name");

      if (fetchError) throw fetchError;

      const transformed: MedicalExaminationType[] = (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        facility: t.facility,
        periodDays: t.period_days,
        description: t.description,
      }));

      setExaminationTypes(transformed);
    } catch (err: any) {
      console.error("Error fetching examination types:", err);
      setError("Nepodařilo se načíst typy prohlídek.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  return { examinationTypes, loading, error, refetch: fetchTypes };
}
