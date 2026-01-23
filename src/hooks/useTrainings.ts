import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TrainingWithDetails {
  id: string;
  status: "valid" | "warning" | "expired";
  date: string; // next_training_date
  type: string;
  employeeNumber: string;
  employeeName: string;
  employeeId: string;
  facility: string;
  department: string;
  departmentId: string | null;
  lastTrainingDate: string;
  trainer: string;
  company: string;
  requester: string;
  period: number;
  reminderTemplate: string;
  calendar: string;
  note: string;
  protocol?: string;
  is_active: boolean;
  remindDaysBefore: number;
  repeatDaysAfter: number;
  trainingTypeId: string;
}

export function useTrainings(activeOnly: boolean = true) {
  const [trainings, setTrainings] = useState<TrainingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainings = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query with joins
      let query = supabase
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
          remind_days_before,
          repeat_days_after,
          reminder_template_id,
          employee_id,
          training_type_id,
          employees!inner (
            id,
            employee_number,
            first_name,
            last_name,
            department_id,
            status,
            departments (
              id,
              code,
              name
            )
          ),
          training_types!inner (
            id,
            name,
            period_days,
            facility
          ),
          reminder_templates (
            id,
            name
          )
        `)
        .order("next_training_date", { ascending: true });

      // Filter based on activeOnly parameter
      if (activeOnly) {
        query = query
          .eq("is_active", true)
          .eq("employees.status", "employed");
      } else {
        // For inactive/paused trainings, get trainings where employee is NOT employed
        query = query.neq("employees.status", "employed");
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Transform data to match our interface
      const transformedData: TrainingWithDetails[] = (data || []).map((t: any) => ({
        id: t.id,
        status: t.status as "valid" | "warning" | "expired",
        date: t.next_training_date,
        type: t.training_types?.name || "",
        employeeNumber: t.employees?.employee_number || "",
        employeeName: `${t.employees?.first_name || ""} ${t.employees?.last_name || ""}`.trim(),
        employeeId: t.employee_id,
        facility: t.facility || t.training_types?.facility || "",
        department: t.employees?.departments?.code || "",
        departmentId: t.employees?.department_id,
        lastTrainingDate: t.last_training_date,
        trainer: t.trainer || "",
        company: t.company || "",
        requester: t.requester || "",
        period: t.training_types?.period_days || 365,
        reminderTemplate: t.reminder_templates?.name || "",
        calendar: "Ano",
        note: t.note || "",
        is_active: t.is_active,
        remindDaysBefore: t.remind_days_before || 30,
        repeatDaysAfter: t.repeat_days_after || 30,
        trainingTypeId: t.training_type_id,
      }));

      setTrainings(transformedData);
    } catch (err: any) {
      console.error("Error fetching trainings:", err);
      setError(err.message || "Nepodařilo se načíst školení");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    fetchTrainings();
  }, [fetchTrainings]);

  return { trainings, loading, error, refetch: fetchTrainings };
}
