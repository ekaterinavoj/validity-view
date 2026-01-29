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
import { useEquipmentResponsibles, ProfileOption } from "@/hooks/useEquipmentResponsibles";
import { Skeleton } from "@/components/ui/skeleton";

interface EquipmentResponsiblesManagerProps {
  equipmentId: string;
  equipmentName?: string;
  compact?: boolean;
}

export function EquipmentResponsiblesManager({
  equipmentId,
  equipmentName,
  compact = false,
}: EquipmentResponsiblesManagerProps) {
  const [open, setOpen] = useState(false);
  const {
    responsibles,
    availableProfiles,
    isLoading,
    addResponsible,
    removeResponsible,
    isAdding,
    isRemoving,
  } = useEquipmentResponsibles(equipmentId);

  // Filter out already assigned profiles
  const unassignedProfiles = availableProfiles.filter(
    (profile) => !responsibles.find((r) => r.profile_id === profile.id)
  );

  const handleAddResponsible = (profile: ProfileOption) => {
    addResponsible({ equipmentId, profileId: profile.id });
    setOpen(false);
  };

  const handleRemoveResponsible = (responsibleId: string) => {
    removeResponsible(responsibleId);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-3/4" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {responsibles.length === 0 ? (
          <span className="text-muted-foreground text-sm">—</span>
        ) : (
          responsibles.map((resp) => (
            <Badge key={resp.id} variant="secondary" className="text-xs">
              {resp.profile?.first_name} {resp.profile?.last_name}
            </Badge>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            Odpovědné osoby {equipmentName ? `pro ${equipmentName}` : ""}
          </span>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isAdding || unassignedProfiles.length === 0}
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
                  {unassignedProfiles.map((profile) => (
                    <CommandItem
                      key={profile.id}
                      value={`${profile.first_name} ${profile.last_name} ${profile.email}`}
                      onSelect={() => handleAddResponsible(profile)}
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

      {responsibles.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Zatím nejsou přiřazeny žádné odpovědné osoby. Přidejte osoby, které
          budou dostávat připomínky k tomuto zařízení.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {responsibles.map((resp) => (
            <Badge
              key={resp.id}
              variant="secondary"
              className="flex items-center gap-1 py-1.5 px-3"
            >
              <User className="w-3 h-3" />
              <span>
                {resp.profile?.first_name} {resp.profile?.last_name}
              </span>
              <button
                onClick={() => handleRemoveResponsible(resp.id)}
                disabled={isRemoving}
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
