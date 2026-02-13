import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  employeeWorkCategory: number | null;
  facility: string;
  department: string;
  departmentId: string | null;
  doctor: string;
  medicalFacility: string;
  result: string;
  requester: string;
  period: number;
  reminderTemplate: string;
  note: string;
  is_active: boolean;
  remindDaysBefore: number;
  repeatDaysAfter: number;
  examinationTypeId: string;
  deletedAt: string | null;
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
          remind_days_before,
          repeat_days_after,
          reminder_template_id,
          employee_id,
          examination_type_id,
          deleted_at,
          employees (
            id,
            employee_number,
            first_name,
            last_name,
            department_id,
            status,
            work_category,
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
        .order("next_examination_date", { ascending: true });

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
            // Show only active examinations (employee is employed and examination is active)
            return isActive && employeeStatus === "employed";
          } else {
            // Show suspended examinations (inactive or employee not employed)
            return !isActive || employeeStatus !== "employed";
          }
        })
        .map((e: any) => ({
          id: e.id,
          status: computeStatus(e.next_examination_date),
          nextExaminationDate: e.next_examination_date,
          lastExaminationDate: e.last_examination_date,
          type: e.medical_examination_types?.name || "",
          employeeNumber: e.employees?.employee_number || "",
          employeeName: `${e.employees?.first_name || ""} ${e.employees?.last_name || ""}`.trim(),
          employeeId: e.employee_id,
          employeeStatus: e.employees?.status as any,
          employeeWorkCategory: e.employees?.work_category || null,
          facility: e.facility || e.medical_examination_types?.facility || "",
          department: e.employees?.departments?.code || "",
          departmentId: e.employees?.department_id,
          doctor: e.doctor || "",
          medicalFacility: e.medical_facility || "",
          result: e.result || "",
          requester: e.requester || "",
          period: e.medical_examination_types?.period_days || 365,
          reminderTemplate: e.medical_reminder_templates?.name || "",
          note: e.note || "",
          is_active: e.is_active,
          remindDaysBefore: e.remind_days_before ?? 30,
          repeatDaysAfter: e.repeat_days_after ?? 30,
          examinationTypeId: e.examination_type_id,
          deletedAt: e.deleted_at,
        }));

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

  return { examinations, loading, error, refetch: fetchExaminations };
}
