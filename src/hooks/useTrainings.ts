import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TrainingWithDetails {
  id: string;
  status: "valid" | "warning" | "expired";
  result: "passed" | "passed_with_reservations" | "failed";
  date: string; // next_training_date
  type: string;
  typeDescription: string;
  typePeriodDays: number;
  employeeNumber: string;
  employeeName: string;
  employeeId: string;
  employeeStatus: "employed" | "parental_leave" | "sick_leave" | "terminated";
  facility: string;
  department: string;
  departmentName: string;
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
  deletedAt: string | null; // Soft-delete timestamp
  fixedAt: string | null;
  fixedByName: string | null;
  fixedNote: string | null;
}

export function useTrainings(activeOnly: boolean = true) {
  const [trainings, setTrainings] = useState<TrainingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainings = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First fetch all trainings with joins - exclude archived (deleted_at IS NOT NULL)
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
          result,
          is_active,
          last_training_date,
          next_training_date,
          period_days_override,
          remind_days_before,
          repeat_days_after,
          reminder_template_id,
          employee_id,
          training_type_id,
          deleted_at,
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
            facility,
            description
          ),
          reminder_templates (
            id,
            name
          )
        `)
        .is("deleted_at", null) // Exclude archived trainings
        .order("next_training_date", { ascending: true })
        .limit(50000);

      if (fetchError) throw fetchError;

      // Transform and filter data based on activeOnly parameter
      // Compute status dynamically on read to avoid stale status
      const computeStatus = (nextDate: string | null | undefined): "valid" | "warning" | "expired" => {
        if (!nextDate) return "expired";
        const next = new Date(nextDate);
        if (isNaN(next.getTime())) return "expired";
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
          const isActive = t.is_active;
          const employeeStatus = t.employees?.status;
          if (activeOnly) {
            // Active trainings: employee is employed AND training is active
            return isActive && employeeStatus === "employed";
          } else {
            // Inactive trainings: either is_active is false OR employee is NOT employed
            return !isActive || employeeStatus !== "employed";
          }
        })
        .map((t: any) => {
          const result = (t.result as "passed" | "passed_with_reservations" | "failed") || "passed";
          // If result is failed, force expired status
          const computedStatus = result === "failed" ? "expired" : computeStatus(t.next_training_date);
          return {
            id: t.id,
            status: computedStatus,
            result,
            date: t.next_training_date,
            type: t.training_types?.name || "",
            typeDescription: t.training_types?.description || "",
            typePeriodDays: t.training_types?.period_days ?? 365,
            employeeNumber: t.employees?.employee_number || "",
            employeeName: `${t.employees?.first_name || ""} ${t.employees?.last_name || ""}`.trim(),
            employeeId: t.employee_id,
            employeeStatus: t.employees?.status as "employed" | "parental_leave" | "sick_leave" | "terminated",
            facility: t.facility || t.training_types?.facility || "",
            department: t.employees?.departments?.code || "",
            departmentName: t.employees?.departments?.name || "",
            departmentId: t.employees?.department_id,
            lastTrainingDate: t.last_training_date,
            trainer: t.trainer || "",
            company: t.company || "",
            requester: t.requester || "",
            period: t.period_days_override ?? t.training_types?.period_days ?? 365,
            reminderTemplate: t.reminder_templates?.name || "",
            calendar: "Ano",
            note: t.note || "",
            is_active: t.is_active,
            remindDaysBefore: t.remind_days_before ?? 30,
            repeatDaysAfter: t.repeat_days_after ?? 30,
            trainingTypeId: t.training_type_id,
            deletedAt: t.deleted_at,
          };
        });

      const statusOrder = { expired: 0, warning: 1, valid: 2 };
      transformedData.sort((a, b) => {
        const sa = statusOrder[a.status] ?? 2;
        const sb = statusOrder[b.status] ?? 2;
        if (sa !== sb) return sa - sb;
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return da - db;
      });

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

  useEffect(() => {
    const channel = supabase
      .channel("trainings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "trainings" }, () => {
        fetchTrainings();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchTrainings]);

  return { trainings, loading, error, refetch: fetchTrainings };
}
