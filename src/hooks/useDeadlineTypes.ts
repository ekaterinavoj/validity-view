import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeadlineType } from "@/types/equipment";
import { useToast } from "@/hooks/use-toast";

export function useDeadlineTypes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deadlineTypes = [], isLoading, error, refetch } = useQuery({
    queryKey: ["deadline-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deadline_types")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as DeadlineType[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newType: Omit<DeadlineType, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("deadline_types")
        .insert(newType)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadline-types"] });
      toast({ title: "Typ lhůty byl přidán" });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při přidávání typu lhůty",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DeadlineType> & { id: string }) => {
      const { data, error } = await supabase
        .from("deadline_types")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadline-types"] });
      toast({ title: "Typ lhůty byl aktualizován" });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při aktualizaci typu lhůty",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check for dependent deadlines
      const { count, error: countError } = await supabase
        .from("deadlines")
        .select("id", { count: "exact", head: true })
        .eq("deadline_type_id", id);

      if (countError) throw countError;

      if (count && count > 0) {
        throw new Error(`Tento typ události má přiřazených ${count} technických lhůt. Nejprve odstraňte nebo přesuňte tyto lhůty.`);
      }

      const { error } = await supabase.from("deadline_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadline-types"] });
      toast({ title: "Typ lhůty byl smazán" });
    },
    onError: (error: Error) => {
      toast({
        title: "Nelze smazat typ události",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    deadlineTypes,
    isLoading,
    error,
    refetch,
    createDeadlineType: createMutation.mutate,
    updateDeadlineType: updateMutation.mutate,
    deleteDeadlineType: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
