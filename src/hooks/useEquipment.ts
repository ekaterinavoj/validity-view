import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Equipment } from "@/types/equipment";
import { useToast } from "@/hooks/use-toast";

interface CreateEquipmentWithResponsibles {
  equipment: Omit<Equipment, "id" | "created_at" | "updated_at">;
  responsibleProfileIds?: string[];
}

export function useEquipment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: equipment = [], isLoading, error, refetch } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Equipment[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ equipment: newEquipment, responsibleProfileIds = [] }: CreateEquipmentWithResponsibles) => {
      // Create the equipment
      const { data, error } = await supabase
        .from("equipment")
        .insert(newEquipment)
        .select()
        .single();

      if (error) throw error;

      // If there are responsible persons to add, create them
      if (responsibleProfileIds.length > 0 && data) {
        const { data: user } = await supabase.auth.getUser();
        
        const responsiblesData = responsibleProfileIds.map(profileId => ({
          equipment_id: data.id,
          profile_id: profileId,
          created_by: user.user?.id || null,
        }));

        const { error: responsiblesError } = await supabase
          .from("equipment_responsibles")
          .insert(responsiblesData);

        if (responsiblesError) {
          console.error("Error adding responsible persons:", responsiblesError);
          // Don't throw - equipment was created, just log the error
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-responsibles"] });
      queryClient.invalidateQueries({ queryKey: ["all-equipment-responsibles"] });
      toast({ title: "Zařízení bylo přidáno" });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při přidávání zařízení",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Equipment> & { id: string }) => {
      const { data, error } = await supabase
        .from("equipment")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast({ title: "Zařízení bylo aktualizováno" });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při aktualizaci zařízení",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast({ title: "Zařízení bylo smazáno" });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při mazání zařízení",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    equipment,
    isLoading,
    error,
    refetch,
    createEquipment: createMutation.mutate,
    updateEquipment: updateMutation.mutate,
    deleteEquipment: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
