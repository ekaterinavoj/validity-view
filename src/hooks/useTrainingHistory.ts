import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HistoryTraining {
  id: string;
  status: "valid" | "warning" | "expired";
  date: string;
  type: string;
  employeeNumber: string;
  employeeName: string;
  employeeId: string;
  employeeStatus: "employed" | "parental_leave" | "sick_leave" | "terminated";
  facility: string;
  department: string;
  lastTrainingDate: string;
  trainer: string;
  company: string;
  requester: string;
  period: number;
  note: string;
}

export function useTrainingHistory() {
  const [trainings, setTrainings] = useState<HistoryTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch ALL trainings regardless of employee status (for history)
      const { data, error: fetchError } = await supabase
        .from("trainings")
        .select(`
          id,
          facility,
          trainer,
          company,
          requester,
          note,
          status,
          is_active,
          last_training_date,
          next_training_date,
          employee_id,
          training_type_id,
          employees (
            id,
            employee_number,
            first_name,
            last_name,
            status,
            departments (
              id,
              code,
              name
            )
          ),
          training_types (
            id,
            name,
            period_days,
            facility
          )
        `)
        .order("last_training_date", { ascending: false });

      if (fetchError) throw fetchError;

      const transformedData: HistoryTraining[] = (data || []).map((t: any) => ({
        id: t.id,
        status: t.status as "valid" | "warning" | "expired",
        date: t.last_training_date,
        type: t.training_types?.name || "",
        employeeNumber: t.employees?.employee_number || "",
        employeeName: `${t.employees?.first_name || ""} ${t.employees?.last_name || ""}`.trim(),
        employeeId: t.employee_id,
        employeeStatus: t.employees?.status as "employed" | "parental_leave" | "sick_leave" | "terminated",
        facility: t.facility || t.training_types?.facility || "",
        department: t.employees?.departments?.code || "",
        lastTrainingDate: t.last_training_date,
        trainer: t.trainer || "",
        company: t.company || "",
        requester: t.requester || "",
        period: t.training_types?.period_days || 365,
        note: t.note || "",
      }));

      setTrainings(transformedData);
    } catch (err: any) {
      console.error("Error fetching training history:", err);
      setError("Nepodařilo se načíst historii školení. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { trainings, loading, error, refetch: fetchHistory };
}
