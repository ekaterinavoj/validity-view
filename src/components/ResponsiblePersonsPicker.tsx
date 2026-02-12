import { useState } from "react";
import { X, Plus, User, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ResponsiblePersonsPickerProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  label?: string;
}

export function ResponsiblePersonsPicker({
  selectedIds,
  onSelectionChange,
  label = "Odpovědné osoby",
}: ResponsiblePersonsPickerProps) {
  const [open, setOpen] = useState(false);
  const { user, isAdmin, isManager } = useAuth();

  // Fetch profiles based on role:
  // - Admins see all approved profiles
  // - Managers see only themselves and their subordinates
  const { data: availableProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["available-profiles-for-picker", user?.id, isAdmin, isManager],
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
        const { data: managerProfile, error: profileError } = await supabase
          .from("profiles")
          .select("employee_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const { data: ownProfile, error: ownError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("id", user.id)
          .eq("approval_status", "approved")
          .maybeSingle();

        if (ownError) throw ownError;

        const profiles: ProfileOption[] = ownProfile ? [ownProfile] : [];

        if (managerProfile?.employee_id) {
          const { data: subordinateIds, error: subError } = await supabase
            .rpc("get_subordinate_employee_ids", { 
              root_employee_id: managerProfile.employee_id 
            });

          if (subError) throw subError;

          if (subordinateIds && subordinateIds.length > 0) {
            const employeeIds = subordinateIds
              .map((s: { employee_id: string }) => s.employee_id)
              .filter((id: string) => id !== managerProfile.employee_id);

            if (employeeIds.length > 0) {
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
    staleTime: 5 * 60 * 1000, // 5 min – hierarchy changes are infrequent
    refetchOnWindowFocus: true, // refresh when user returns to the tab
  });

  // Check if manager is missing employee_id link
  const { data: managerEmployeeId } = useQuery({
    queryKey: ["manager-employee-link", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("employee_id")
        .eq("id", user.id)
        .maybeSingle();
      return data?.employee_id ?? null;
    },
    enabled: !!user?.id && isManager && !isAdmin,
    staleTime: 10 * 60 * 1000,
  });

  const showManagerHint = isManager && !isAdmin && managerEmployeeId === null && !isLoadingProfiles;

  // Get selected profiles with full data
  const selectedProfiles = availableProfiles.filter((p) =>
    selectedIds.includes(p.id)
  );

  // Get unselected profiles
  const unselectedProfiles = availableProfiles.filter(
    (p) => !selectedIds.includes(p.id)
  );

  const handleAddPerson = (profile: ProfileOption) => {
    // Deduplicate using Set
    const uniqueIds = [...new Set([...selectedIds, profile.id])];
    onSelectionChange(uniqueIds);
    setOpen(false);
  };

  const handleRemovePerson = (profileId: string) => {
    onSelectionChange(selectedIds.filter((id) => id !== profileId));
  };

  return (
    <div className="space-y-4">
      {showManagerHint && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Váš profil není propojen se záznamem zaměstnance. Podřízené osoby nelze načíst.
            Požádejte administrátora o propojení vašeho účtu.
          </span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={unselectedProfiles.length === 0}
            >
              <Plus className="w-4 h-4 mr-1" />
              Přidat osobu
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Hledat osobu..." />
              <CommandList>
                <CommandEmpty>Žádná osoba nenalezena</CommandEmpty>
                <CommandGroup>
                  {unselectedProfiles.map((profile) => (
                    <CommandItem
                      key={profile.id}
                      value={`${profile.first_name} ${profile.last_name} ${profile.email}`}
                      onSelect={() => handleAddPerson(profile)}
                      className="cursor-pointer"
                    >
                      <User className="w-4 h-4 mr-2 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span>
                          {profile.first_name} {profile.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {profile.email}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {selectedProfiles.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Zatím nejsou vybrány žádné odpovědné osoby. Přidejte osoby, které
          budou dostávat připomínky k tomuto zařízení.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selectedProfiles.map((profile) => (
            <Badge
              key={profile.id}
              variant="secondary"
              className="flex items-center gap-1 py-1.5 px-3"
            >
              <User className="w-3 h-3" />
              <span>
                {profile.first_name} {profile.last_name}
              </span>
              <button
                type="button"
                onClick={() => handleRemovePerson(profile.id)}
                className="ml-1 hover:text-destructive transition-colors"
                title="Odebrat osobu"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
