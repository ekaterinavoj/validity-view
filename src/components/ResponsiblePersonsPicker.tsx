import { useState } from "react";
import { X, Plus, User, Users } from "lucide-react";
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

  // Fetch all available profiles
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

  // Get selected profiles with full data
  const selectedProfiles = availableProfiles.filter((p) =>
    selectedIds.includes(p.id)
  );

  // Get unselected profiles
  const unselectedProfiles = availableProfiles.filter(
    (p) => !selectedIds.includes(p.id)
  );

  const handleAddPerson = (profile: ProfileOption) => {
    onSelectionChange([...selectedIds, profile.id]);
    setOpen(false);
  };

  const handleRemovePerson = (profileId: string) => {
    onSelectionChange(selectedIds.filter((id) => id !== profileId));
  };

  return (
    <div className="space-y-4">
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
