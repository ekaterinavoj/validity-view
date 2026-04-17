import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HistoryDeadline {
  id: string;
  status: "valid" | "warning" | "expired";
  equipmentId: string;
  equipmentName: string;
  inventoryNumber: string;
  equipmentType: string;
  deadlineTypeName: string;
  facility: string;
  lastCheckDate: string;
  nextCheckDate: string;
  period: number;
  performer: string;
  company: string;
  requester: string;
  note: string;
  result: string | null;
  deletedAt: string | null;
  isArchived: boolean;
  // Pass-through fields used by the page
  equipment: {
    id: string;
    inventory_number: string;
    name: string;
    equipment_type: string;
    facility: string;
    department_id?: string | null;
    status: string;
    location?: string | null;
    responsible_person?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    serial_number?: string | null;
  } | null;
  deadline_type: {
    id: string;
    name: string;
    facility: string;
    period_days: number;
    description?: string | null;
  } | null;
  // Raw fields needed by page actions
  deleted_at: string | null;
  last_check_date: string;
  next_check_date: string;
  performer_raw: string | null;
  company_raw: string | null;
  originalRecordId: string | null;
  isVersion: boolean;
  fixed_at: string | null;
  fixed_by_name: string | null;
  fixed_note: string | null;
}

export function useDeadlineHistory(includeArchived: boolean = false) {
  const [history, setHistory] = useState<HistoryDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("deadlines")
        .select(`
          id,
          facility,
          performer,
          company,
          requester,
          note,
          status,
          result,
          is_active,
          last_check_date,
          next_check_date,
          equipment_id,
          deadline_type_id,
          deleted_at,
          period_days_override,
          fixed_at,
          fixed_by_name,
          fixed_note,
          equipment:equipment_id (
            id, inventory_number, name, equipment_type, facility, department_id, status, location, responsible_person, manufacturer, model, serial_number
          ),
          deadline_types:deadline_type_id (
            id, name, facility, period_days, description
          ),
          original_record_id
        `)
        .order("last_check_date", { ascending: false })
        .limit(50000);

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

      const transformedData: HistoryDeadline[] = (data || []).map((d: any) => {
        const eq = d.equipment;
        const dt = d.deadline_types;
        const effectivePeriod = d.period_days_override ?? dt?.period_days ?? 365;

        return {
          id: d.id,
          status: computeStatus(d.next_check_date),
          equipmentId: d.equipment_id,
          equipmentName: eq?.name || "",
          inventoryNumber: eq?.inventory_number || "",
          equipmentType: eq?.equipment_type || "",
          deadlineTypeName: dt?.name || "",
          facility: d.facility || dt?.facility || "",
          lastCheckDate: d.last_check_date,
          nextCheckDate: d.next_check_date,
          period: effectivePeriod,
          performer: d.performer || "",
          company: d.company || "",
          requester: d.requester || "",
          note: d.note || "",
          result: d.result || null,
          deletedAt: d.deleted_at,
          isArchived: d.deleted_at !== null && !d.original_record_id,
          originalRecordId: d.original_record_id || null,
          isVersion: !!d.original_record_id,
          equipment: eq || null,
          deadline_type: dt ? { id: dt.id, name: dt.name, facility: dt.facility, period_days: dt.period_days, description: dt.description } : null,
          deleted_at: d.deleted_at,
          last_check_date: d.last_check_date,
          next_check_date: d.next_check_date,
          performer_raw: d.performer,
          company_raw: d.company,
          fixed_at: d.fixed_at || null,
          fixed_by_name: d.fixed_by_name || null,
          fixed_note: d.fixed_note || null,
        };
      });

      setHistory(transformedData);
    } catch (err: any) {
      console.error("Error fetching deadline history:", err);
      setError("Nepodařilo se načíst historii událostí. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, error, refetch: fetchHistory };
}
