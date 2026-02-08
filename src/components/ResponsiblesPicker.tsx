import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Users, User, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useResponsibilityOptions, ResponsibleProfile, ResponsibilityGroup } from "@/hooks/useDeadlineResponsibles";

export interface ResponsiblesSelection {
  profileIds: string[];
  groupIds: string[];
}

interface ResponsiblesPickerProps {
  value: ResponsiblesSelection;
  onChange: (value: ResponsiblesSelection) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ResponsiblesPicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Vyberte odpovědné osoby nebo skupiny",
  className,
}: ResponsiblesPickerProps) {
  const [open, setOpen] = useState(false);
  const { profiles, groups, isLoading } = useResponsibilityOptions();

  const selectedProfiles = profiles.filter(p => value.profileIds.includes(p.id));
  const selectedGroups = groups.filter(g => value.groupIds.includes(g.id));
  const totalSelected = selectedProfiles.length + selectedGroups.length;

  const toggleProfile = (profileId: string) => {
    const newProfileIds = value.profileIds.includes(profileId)
      ? value.profileIds.filter(id => id !== profileId)
      : [...value.profileIds, profileId];
    onChange({ ...value, profileIds: newProfileIds });
  };

  const toggleGroup = (groupId: string) => {
    const newGroupIds = value.groupIds.includes(groupId)
      ? value.groupIds.filter(id => id !== groupId)
      : [...value.groupIds, groupId];
    onChange({ ...value, groupIds: newGroupIds });
  };

  const removeProfile = (profileId: string) => {
    onChange({
      ...value,
      profileIds: value.profileIds.filter(id => id !== profileId),
    });
  };

  const removeGroup = (groupId: string) => {
    onChange({
      ...value,
      groupIds: value.groupIds.filter(id => id !== groupId),
    });
  };

  const clearAll = () => {
    onChange({ profileIds: [], groupIds: [] });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className="w-full justify-between min-h-[40px] h-auto"
          >
            <span className="truncate text-left">
              {totalSelected > 0
                ? `Vybráno: ${totalSelected} ${totalSelected === 1 ? "položka" : totalSelected < 5 ? "položky" : "položek"}`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Hledat osobu nebo skupinu..." />
            <CommandList>
              <CommandEmpty>Žádné výsledky.</CommandEmpty>
              
              {/* Groups section */}
              {groups.length > 0 && (
                <CommandGroup heading="Skupiny">
                  {groups.map(group => (
                    <CommandItem
                      key={`group-${group.id}`}
                      value={`group-${group.name}`}
                      onSelect={() => toggleGroup(group.id)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">{group.name}</div>
                          {group.members && group.members.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {group.members.length} {group.members.length === 1 ? "člen" : group.members.length < 5 ? "členové" : "členů"}
                            </div>
                          )}
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          value.groupIds.includes(group.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {groups.length > 0 && profiles.length > 0 && <CommandSeparator />}

              {/* Profiles section */}
              {profiles.length > 0 && (
                <CommandGroup heading="Osoby">
                  {profiles.map(profile => (
                    <CommandItem
                      key={`profile-${profile.id}`}
                      value={`profile-${profile.first_name} ${profile.last_name} ${profile.email}`}
                      onSelect={() => toggleProfile(profile.id)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium">
                            {profile.first_name} {profile.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">{profile.email}</div>
                        </div>
                      </div>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          value.profileIds.includes(profile.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected items display */}
      {totalSelected > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedGroups.map(group => (
            <Badge
              key={`selected-group-${group.id}`}
              variant="secondary"
              className="gap-1 pl-1.5"
            >
              <Users className="h-3 w-3" />
              {group.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeGroup(group.id)}
                  className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {selectedProfiles.map(profile => (
            <Badge
              key={`selected-profile-${profile.id}`}
              variant="outline"
              className="gap-1 pl-1.5"
            >
              <User className="h-3 w-3" />
              {profile.first_name} {profile.last_name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeProfile(profile.id)}
                  className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {!disabled && totalSelected > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-6 px-2 text-xs text-muted-foreground"
            >
              Vymazat vše
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
