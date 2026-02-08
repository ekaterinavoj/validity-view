import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user, isAdmin, isManager } = useAuth();

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

  // Fetch available profiles based on role:
  // - Admins see all approved profiles
  // - Managers see only themselves and their subordinates
  const { data: availableProfiles = [] } = useQuery({
    queryKey: ["available-profiles-for-equipment", user?.id, isAdmin, isManager],
    queryFn: async () => {
      if (!user?.id) return [];

      // Admins see all approved profiles
      if (isAdmin) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("approval_status", "approved")
          .order("last_name");

        if (error) throw error;
        return data as ProfileOption[];
      }

      // Managers see only themselves + their subordinates
      if (isManager) {
        // First, get the manager's employee_id from their profile
        const { data: managerProfile, error: profileError } = await supabase
          .from("profiles")
          .select("employee_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        // Get manager's own profile first
        const { data: ownProfile, error: ownError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("id", user.id)
          .eq("approval_status", "approved")
          .maybeSingle();

        if (ownError) throw ownError;

        const profiles: ProfileOption[] = ownProfile ? [ownProfile] : [];

        // If manager has an employee_id, fetch subordinates
        if (managerProfile?.employee_id) {
          // Get subordinate employee IDs using the database function
          const { data: subordinateIds, error: subError } = await supabase
            .rpc("get_subordinate_employee_ids", { 
              root_employee_id: managerProfile.employee_id 
            });

          if (subError) throw subError;

          if (subordinateIds && subordinateIds.length > 0) {
            // Get employee IDs (excluding the manager themselves)
            const employeeIds = subordinateIds
              .map((s: { employee_id: string }) => s.employee_id)
              .filter((id: string) => id !== managerProfile.employee_id);

            if (employeeIds.length > 0) {
              // Get profiles linked to these employees
              const { data: subordinateProfiles, error: subProfileError } = await supabase
                .from("profiles")
                .select("id, first_name, last_name, email")
                .in("employee_id", employeeIds)
                .eq("approval_status", "approved")
                .order("last_name");

              if (subProfileError) throw subProfileError;

              if (subordinateProfiles) {
                profiles.push(...subordinateProfiles);
              }
            }
          }
        }

        return profiles;
      }

      // Regular users see only themselves
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("id", user.id)
        .eq("approval_status", "approved");

      if (error) throw error;
      return data as ProfileOption[];
    },
    enabled: !!user?.id,
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
