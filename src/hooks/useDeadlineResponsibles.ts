import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ResponsibleProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  position?: string;
}

export interface ResponsibilityGroup {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  members?: ResponsibleProfile[];
}

export interface DeadlineResponsible {
  id: string;
  deadline_id: string;
  profile_id: string | null;
  group_id: string | null;
  profile?: ResponsibleProfile;
  group?: ResponsibilityGroup;
}

export function useResponsibilityOptions() {
  // Fetch all approved profiles for selection
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["responsibility-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, position")
        .eq("approval_status", "approved")
        .order("last_name");

      if (error) throw error;
      return data as ResponsibleProfile[];
    },
  });

  // Fetch all active responsibility groups
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["responsibility-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsibility_groups")
        .select(`
          id, name, description, is_active,
          members:responsibility_group_members(
            profile:profiles(id, first_name, last_name, email)
          )
        `)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      
      // Transform nested members structure
      return (data || []).map(g => ({
        ...g,
        members: g.members?.map((m: any) => m.profile).filter(Boolean) || []
      })) as ResponsibilityGroup[];
    },
  });

  return {
    profiles,
    groups,
    isLoading: profilesLoading || groupsLoading,
  };
}

export function useDeadlineResponsibles(deadlineId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch responsibles for a specific deadline
  const { data: responsibles = [], isLoading } = useQuery({
    queryKey: ["deadline-responsibles", deadlineId],
    queryFn: async () => {
      if (!deadlineId) return [];
      
      const { data, error } = await supabase
        .from("deadline_responsibles")
        .select(`
          id, deadline_id, profile_id, group_id,
          profile:profiles(id, first_name, last_name, email),
          group:responsibility_groups(id, name, description)
        `)
        .eq("deadline_id", deadlineId);

      if (error) throw error;
      return (data || []) as DeadlineResponsible[];
    },
    enabled: !!deadlineId,
  });

  // Set responsibles for a deadline (replaces all existing)
  const setResponsiblesMutation = useMutation({
    mutationFn: async ({ 
      deadlineId, 
      profileIds, 
      groupIds 
    }: { 
      deadlineId: string; 
      profileIds: string[]; 
      groupIds: string[] 
    }) => {
      // Delete existing responsibles
      const { error: deleteError } = await supabase
        .from("deadline_responsibles")
        .delete()
        .eq("deadline_id", deadlineId);

      if (deleteError) throw deleteError;

      // Insert new profile responsibles
      const profileInserts = profileIds.map(profileId => ({
        deadline_id: deadlineId,
        profile_id: profileId,
        created_by: null, // Will be set by trigger or RLS
      }));

      // Insert new group responsibles
      const groupInserts = groupIds.map(groupId => ({
        deadline_id: deadlineId,
        group_id: groupId,
        created_by: null,
      }));

      const allInserts = [...profileInserts, ...groupInserts];

      if (allInserts.length > 0) {
        const { error: insertError } = await supabase
          .from("deadline_responsibles")
          .insert(allInserts);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deadline-responsibles"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při ukládání odpovědných osob",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add responsibles to a new deadline (used in create flow)
  const addResponsiblesMutation = useMutation({
    mutationFn: async ({ 
      deadlineId, 
      profileIds, 
      groupIds 
    }: { 
      deadlineId: string; 
      profileIds: string[]; 
      groupIds: string[] 
    }) => {
      const profileInserts = profileIds.map(profileId => ({
        deadline_id: deadlineId,
        profile_id: profileId,
      }));

      const groupInserts = groupIds.map(groupId => ({
        deadline_id: deadlineId,
        group_id: groupId,
      }));

      const allInserts = [...profileInserts, ...groupInserts];

      if (allInserts.length > 0) {
        const { error } = await supabase
          .from("deadline_responsibles")
          .insert(allInserts);

        if (error) throw error;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba při přidávání odpovědných osob",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    responsibles,
    isLoading,
    setResponsibles: setResponsiblesMutation.mutateAsync,
    addResponsibles: addResponsiblesMutation.mutateAsync,
    isUpdating: setResponsiblesMutation.isPending || addResponsiblesMutation.isPending,
  };
}

// Get all email addresses for notification recipients
export async function getDeadlineNotificationRecipients(deadlineId: string): Promise<string[]> {
  const emails = new Set<string>();

  // Fetch direct profile responsibles
  const { data: profileResponsibles } = await supabase
    .from("deadline_responsibles")
    .select("profile:profiles(email)")
    .eq("deadline_id", deadlineId)
    .not("profile_id", "is", null);

  if (profileResponsibles) {
    for (const r of profileResponsibles) {
      if ((r as any).profile?.email) {
        emails.add((r as any).profile.email);
      }
    }
  }

  // Fetch group responsibles and their members
  const { data: groupResponsibles } = await supabase
    .from("deadline_responsibles")
    .select(`
      group:responsibility_groups(
        members:responsibility_group_members(
          profile:profiles(email)
        )
      )
    `)
    .eq("deadline_id", deadlineId)
    .not("group_id", "is", null);

  if (groupResponsibles) {
    for (const r of groupResponsibles) {
      const members = (r as any).group?.members || [];
      for (const member of members) {
        if (member.profile?.email) {
          emails.add(member.profile.email);
        }
      }
    }
  }

  return Array.from(emails);
}
