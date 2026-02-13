import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HistoryExamination {
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
  doctor: string;
  medicalFacility: string;
  result: string;
  note: string;
  deletedAt: string | null;
  isArchived: boolean;
}

export function useMedicalExaminationHistory(includeArchived: boolean = false) {
  const [examinations, setExaminations] = useState<HistoryExamination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("medical_examinations")
        .select(`
          id,
          facility,
          doctor,
          medical_facility,
          result,
          note,
          status,
          is_active,
          last_examination_date,
          next_examination_date,
          employee_id,
          examination_type_id,
          deleted_at,
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
          medical_examination_types (
            id,
            name,
            period_days,
            facility
          )
        `)
        .order("last_examination_date", { ascending: false });

      if (!includeArchived) {
        query = query.is("deleted_at", null);
      }

      const { data, error: fetchError } = await query;

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

      const transformedData: HistoryExamination[] = (data || []).map((t: any) => ({
        id: t.id,
        status: computeStatus(t.next_examination_date),
        date: t.last_examination_date,
        type: t.medical_examination_types?.name || "",
        employeeNumber: t.employees?.employee_number || "",
        employeeName: `${t.employees?.first_name || ""} ${t.employees?.last_name || ""}`.trim(),
        employeeId: t.employee_id,
        employeeStatus: t.employees?.status as any,
        facility: t.facility || t.medical_examination_types?.facility || "",
        department: t.employees?.departments?.code || "",
        doctor: t.doctor || "",
        medicalFacility: t.medical_facility || "",
        result: t.result || "",
        note: t.note || "",
        deletedAt: t.deleted_at,
        isArchived: t.deleted_at !== null,
      }));

      setExaminations(transformedData);
    } catch (err: any) {
      console.error("Error fetching medical examination history:", err);
      setError("Nepodařilo se načíst historii prohlídek. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { examinations, loading, error, refetch: fetchHistory };
}
