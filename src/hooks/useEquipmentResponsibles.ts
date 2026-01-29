import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EquipmentResponsible {
  id: string;
  equipment_id: string;
  profile_id: string;
  created_at: string;
  created_by: string | null;
  profile?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface ProfileOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
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
          created_by,
          profile:profiles!equipment_responsibles_profile_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq("equipment_id", equipmentId);

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        profile: Array.isArray(item.profile) ? item.profile[0] : item.profile,
      })) as EquipmentResponsible[];
    },
    enabled: !!equipmentId,
  });

  // Fetch all available profiles for selection
  const { data: availableProfiles = [] } = useQuery({
    queryKey: ["available-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("approval_status", "approved")
        .order("last_name");

      if (error) throw error;
      return data as ProfileOption[];
    },
  });

  // Add responsible person
  const addMutation = useMutation({
    mutationFn: async ({ equipmentId, profileId }: { equipmentId: string; profileId: string }) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("equipment_responsibles")
        .insert({
          equipment_id: equipmentId,
          profile_id: profileId,
          created_by: user.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-responsibles"] });
      queryClient.invalidateQueries({ queryKey: ["all-equipment-responsibles"] });
      toast({ title: "Odpovědná osoba byla přiřazena" });
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        toast({
          title: "Tato osoba je již přiřazena",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Chyba při přiřazování osoby",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  // Remove responsible person
  const removeMutation = useMutation({
    mutationFn: async (responsibleId: string) => {
      const { error } = await supabase
        .from("equipment_responsibles")
        .delete()
        .eq("id", responsibleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-responsibles"] });
      queryClient.invalidateQueries({ queryKey: ["all-equipment-responsibles"] });
      toast({ title: "Odpovědná osoba byla odebrána" });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při odebírání osoby",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    responsibles,
    availableProfiles,
    isLoading,
    error,
    refetch,
    addResponsible: addMutation.mutate,
    removeResponsible: removeMutation.mutate,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}

// Hook to fetch all equipment responsibles for filtering
export function useAllEquipmentResponsibles() {
  const { data: allResponsibles = [], isLoading } = useQuery({
    queryKey: ["all-equipment-responsibles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_responsibles")
        .select(`
          id,
          equipment_id,
          profile_id,
          profile:profiles!equipment_responsibles_profile_id_fkey (
            id,
            first_name,
            last_name,
            email
          )
        `);

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        profile: Array.isArray(item.profile) ? item.profile[0] : item.profile,
      }));
    },
  });

  // Get unique profiles for filter dropdown
  const uniqueProfiles = allResponsibles.reduce((acc, item) => {
    if (item.profile && !acc.find(p => p.id === item.profile.id)) {
      acc.push(item.profile);
    }
    return acc;
  }, [] as ProfileOption[]);

  // Get equipment IDs for a specific profile
  const getEquipmentIdsByProfile = (profileId: string): string[] => {
    return allResponsibles
      .filter(r => r.profile_id === profileId)
      .map(r => r.equipment_id);
  };

  return {
    allResponsibles,
    uniqueProfiles,
    getEquipmentIdsByProfile,
    isLoading,
  };
}
