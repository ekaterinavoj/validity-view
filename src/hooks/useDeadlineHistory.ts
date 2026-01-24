import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Deadline } from "@/types/equipment";

interface DeadlineWithRelations {
  id: string;
  equipment_id: string;
  deadline_type_id: string;
  facility: string;
  last_check_date: string;
  next_check_date: string;
  status: "valid" | "warning" | "expired";
  remind_days_before: number | null;
  repeat_days_after: number | null;
  reminder_template_id: string | null;
  performer: string | null;
  company: string | null;
  requester: string | null;
  note: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  equipment: {
    id: string;
    inventory_number: string;
    name: string;
    equipment_type: string;
    facility: string;
    department_id: string | null;
    status: string;
    location: string | null;
    responsible_person: string | null;
  } | null;
  deadline_types: {
    id: string;
    name: string;
    facility: string;
    period_days: number;
  } | null;
}

export function useDeadlineHistory() {
  const { data: history = [], isLoading, error, refetch } = useQuery({
    queryKey: ["deadline-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadlines")
        .select(`
          *,
          equipment:equipment_id (
            id, inventory_number, name, equipment_type, facility, department_id, status, location, responsible_person
          ),
          deadline_types:deadline_type_id (
            id, name, facility, period_days
          )
        `)
        .order("last_check_date", { ascending: false });

      if (error) throw error;
      
      return (data as DeadlineWithRelations[]).map((item) => ({
        ...item,
        deadline_type: item.deadline_types,
      })) as Deadline[];
    },
  });

  return {
    history,
    isLoading,
    error,
    refetch,
  };
}
