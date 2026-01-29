import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EquipmentResponsible {
  id: string;
  equipment_id: string;
  profile_id: string;
  created_at: string;
  profile?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export function useEquipmentResponsibles(equipmentId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch responsibles for a specific equipment
  const { data: responsibles = [], isLoading, error, refetch } = useQuery({
    queryKey: ["equipment-responsibles", equipmentId],
    queryFn: async () => {
      if (!equipmentId) return [];
      
      const { data, error } = await supabase
        .from("equipment_responsibles")
        .select(`
          id,
          equipment_id,
          profile_id,
          created_at,
          profile:profiles!equipment_responsibles_profile_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq("equipment_id", equipmentId);

      if (error) throw error;
      return data as EquipmentResponsible[];
    },
    enabled: !!equipmentId,
  });

  // Fetch all responsibles (for filters)
  const { data: allResponsibles = [] } = useQuery({
    queryKey: ["all-equipment-responsibles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_responsibles")
        .select(`
          id,
          equipment_id,
          profile_id,
          profile:profiles!equipment_responsibles_profile_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `);

      if (error) throw error;
      return data as EquipmentResponsible[];
    },
  });

  // Fetch all approved profiles for selection
  const { data: availableProfiles = [] } = useQuery({
    queryKey: ["approved-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("approval_status", "approved")
        .order("last_name");

      if (error) throw error;
      return data;
    },
  });

  const addResponsible = useMutation({
    mutationFn: async ({ equipmentId, profileId }: { equipmentId: string; profileId: string }) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("equipment_responsibles")
        .insert({
          equipment_id: equipmentId,
          profile_id: profileId,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-responsibles"] });
      queryClient.invalidateQueries({ queryKey: ["all-equipment-responsibles"] });
      toast({ title: "Odpovědná osoba byla přidána" });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při přidávání odpovědné osoby",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeResponsible = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("equipment_responsibles")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-responsibles"] });
      queryClient.invalidateQueries({ queryKey: ["all-equipment-responsibles"] });
      toast({ title: "Odpovědná osoba byla odebrána" });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při odebírání odpovědné osoby",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    responsibles,
    allResponsibles,
    availableProfiles,
    isLoading,
    error,
    refetch,
    addResponsible: addResponsible.mutate,
    removeResponsible: removeResponsible.mutate,
    isAdding: addResponsible.isPending,
    isRemoving: removeResponsible.isPending,
  };
}
