import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fromDbHealthRisks, type HealthRisks } from "@/lib/healthRisks";
import { getMedicalExaminationStatusFromResult } from "@/lib/medicalExaminationResults";

export interface MedicalExaminationWithDetails {
  id: string;
  status: "valid" | "warning" | "expired";
  nextExaminationDate: string;
  lastExaminationDate: string;
  type: string;
  employeeNumber: string;
  employeeName: string;
  employeeId: string;
  employeeStatus: "employed" | "parental_leave" | "sick_leave" | "terminated";
  employeeWorkCategory: string | null;
  employeeBirthDate: string | null;
  facility: string;
  department: string;
  departmentName: string;
  departmentId: string | null;
  doctor: string;
  medicalFacility: string;
  result: string;
  requester: string;
  period: number;
  reminderTemplate: string;
  note: string;
  healthRisks: HealthRisks;
  is_active: boolean;
  remindDaysBefore: number;
  repeatDaysAfter: number;
  examinationTypeId: string;
  deletedAt: string | null;
  longTermFitnessLossDate: string | null;
}

export function useMedicalExaminations(activeOnly: boolean = true) {
  const [examinations, setExaminations] = useState<MedicalExaminationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExaminations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("medical_examinations")
        .select(`
          id,
          facility,
          doctor,
          medical_facility,
          result,
          requester,
          note,
          status,
          is_active,
          last_examination_date,
          next_examination_date,
          period_days_override,
          remind_days_before,
          repeat_days_after,
          reminder_template_id,
          employee_id,
          examination_type_id,
          deleted_at,
          zdravotni_rizika,
          long_term_fitness_loss_date,
          employees (
            id,
            employee_number,
            first_name,
            last_name,
            department_id,
            status,
            work_category,
            birth_date,
            departments (
              id,
              code,
              name
            )
          ),
          medical_examination_types (
            id,
            name,
            period_days,
            facility
          ),
          medical_reminder_templates (
            id,
            name
          )
        `)
        .is("deleted_at", null)
        .order("next_examination_date", { ascending: true })
        .limit(50000);

      if (fetchError) throw fetchError;

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

      const transformedData: MedicalExaminationWithDetails[] = (data || [])
        .filter((e: any) => {
          const isActive = e.is_active;
          const employeeStatus = e.employees?.status;

          if (activeOnly) {
            return isActive && employeeStatus === "employed";
          }

          return !isActive || employeeStatus !== "employed";
        })
        .map((e: any) => ({
          id: e.id,
          status: getMedicalExaminationStatusFromResult(e.result, computeStatus(e.next_examination_date)),
          nextExaminationDate: e.next_examination_date,
          lastExaminationDate: e.last_examination_date,
          type: e.medical_examination_types?.name || "",
          employeeNumber: e.employees?.employee_number || "",
          employeeName: `${e.employees?.first_name || ""} ${e.employees?.last_name || ""}`.trim(),
          employeeId: e.employee_id,
          employeeStatus: e.employees?.status as any,
          employeeWorkCategory: e.employees?.work_category || null,
          employeeBirthDate: e.employees?.birth_date || null,
          facility: e.facility || e.medical_examination_types?.facility || "",
          department: e.employees?.departments?.code || "",
          departmentName: e.employees?.departments?.name || "",
          departmentId: e.employees?.department_id,
          doctor: e.doctor || "",
          medicalFacility: e.medical_facility || "",
          result: e.result || "",
          requester: e.requester || "",
          period: e.period_days_override ?? e.medical_examination_types?.period_days ?? 365,
          reminderTemplate: e.medical_reminder_templates?.name || "",
          note: e.note || "",
          healthRisks: fromDbHealthRisks(e.zdravotni_rizika),
          is_active: e.is_active,
          remindDaysBefore: e.remind_days_before ?? 30,
          repeatDaysAfter: e.repeat_days_after ?? 30,
          examinationTypeId: e.examination_type_id,
          deletedAt: e.deleted_at,
          longTermFitnessLossDate: e.long_term_fitness_loss_date || null,
        }));

      const statusOrder = { expired: 0, warning: 1, valid: 2 };
      transformedData.sort((a, b) => {
        const sa = statusOrder[a.status] ?? 2;
        const sb = statusOrder[b.status] ?? 2;
        if (sa !== sb) return sa - sb;
        const da = a.nextExaminationDate ? new Date(a.nextExaminationDate).getTime() : 0;
        const db = b.nextExaminationDate ? new Date(b.nextExaminationDate).getTime() : 0;
        return da - db;
      });

      setExaminations(transformedData);
    } catch (err: any) {
      console.error("Error fetching medical examinations:", err);
      setError("Nepodařilo se načíst prohlídky. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    fetchExaminations();
  }, [fetchExaminations]);

  useEffect(() => {
    const channel = supabase
      .channel("medical-examinations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "medical_examinations" }, () => {
        fetchExaminations();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchExaminations]);

  return { examinations, loading, error, refetch: fetchExaminations };
}
