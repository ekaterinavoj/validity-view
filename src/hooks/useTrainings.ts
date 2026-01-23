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
  employeeStatus: "employed" | "parental_leave" | "sick_leave" | "terminated";
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
      // First fetch all trainings with joins
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
          remind_days_before,
          repeat_days_after,
          reminder_template_id,
          employee_id,
          training_type_id,
          employees (
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
          training_types (
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

      if (fetchError) throw fetchError;

      // Transform and filter data based on activeOnly parameter
      // Compute status dynamically on read to avoid stale status
      const computeStatus = (nextDate: string): "valid" | "warning" | "expired" => {
        const next = new Date(nextDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        next.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return "expired";
        if (diffDays <= 30) return "warning";
        return "valid";
      };

      const transformedData: TrainingWithDetails[] = (data || [])
        .filter((t: any) => {
          const employeeStatus = t.employees?.status;
          if (activeOnly) {
            // Active trainings: employee is employed
            return employeeStatus === "employed";
          } else {
            // Inactive trainings: employee is NOT employed
            return employeeStatus !== "employed";
          }
        })
        .map((t: any) => ({
          id: t.id,
          // Compute status dynamically instead of using stored value
          status: computeStatus(t.next_training_date),
          date: t.next_training_date,
          type: t.training_types?.name || "",
          employeeNumber: t.employees?.employee_number || "",
          employeeName: `${t.employees?.first_name || ""} ${t.employees?.last_name || ""}`.trim(),
          employeeId: t.employee_id,
          employeeStatus: t.employees?.status as "employed" | "parental_leave" | "sick_leave" | "terminated",
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
      setError("Nepodařilo se načíst školení. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    fetchTrainings();
  }, [fetchTrainings]);

  return { trainings, loading, error, refetch: fetchTrainings };
}
