import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TrainingType {
  id: string;
  name: string;
  facility: string;
  periodDays: number;
  durationHours: number;
  description?: string;
}

export function useTrainingTypes() {
  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainingTypes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("training_types")
        .select("id, name, facility, period_days, duration_hours, description")
        .order("name", { ascending: true });

      if (fetchError) throw fetchError;

      const transformedData: TrainingType[] = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        facility: t.facility,
        periodDays: t.period_days,
        durationHours: t.duration_hours ?? 1,
        description: t.description,
      }));

      setTrainingTypes(transformedData);
    } catch (err: any) {
      console.error("Error fetching training types:", err);
      setError("Nepodařilo se načíst typy školení. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrainingTypes();
  }, [fetchTrainingTypes]);

  return { trainingTypes, loading, error, refetch: fetchTrainingTypes };
}
