import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Deadline } from "@/types/equipment";
import { useToast } from "@/hooks/use-toast";

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

export function useDeadlines() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deadlines = [], isLoading, error, refetch } = useQuery({
    queryKey: ["deadlines"],
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
        .is("deleted_at", null)
        .order("next_check_date");

      if (error) throw error;
      
      // Transform data to match Deadline type
      return (data as DeadlineWithRelations[]).map((item) => ({
        ...item,
        deadline_type: item.deadline_types,
      })) as Deadline[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newDeadline: Omit<Deadline, "id" | "created_at" | "updated_at" | "equipment" | "deadline_type">) => {
      const { data, error } = await supabase
        .from("deadlines")
        .insert(newDeadline)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      toast({ title: "Technická lhůta byla přidána" });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při přidávání technické lhůty",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Deadline> & { id: string }) => {
      // Remove joined data before update
      const { equipment, deadline_type, ...cleanUpdates } = updates as Deadline;
      
      const { data, error } = await supabase
        .from("deadlines")
        .update(cleanUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      toast({ title: "Technická lhůta byla aktualizována" });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při aktualizaci technické lhůty",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("deadlines")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadlines"] });
      toast({ title: "Technická lhůta byla archivována" });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při archivaci",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    deadlines,
    isLoading,
    error,
    refetch,
    createDeadline: createMutation.mutate,
    updateDeadline: updateMutation.mutate,
    archiveDeadline: archiveMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isArchiving: archiveMutation.isPending,
  };
}
