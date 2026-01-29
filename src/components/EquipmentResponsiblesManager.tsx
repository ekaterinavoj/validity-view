import { useState } from "react";
import { UserPlus, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEquipmentResponsibles } from "@/hooks/useEquipmentResponsibles";
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
  const {
    responsibles,
    availableProfiles,
    isLoading,
    addResponsible,
    removeResponsible,
    isAdding,
    isRemoving,
  } = useEquipmentResponsibles(equipmentId);

  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filter out already assigned profiles
  const unassignedProfiles = availableProfiles.filter(
    (profile) => !responsibles.some((r) => r.profile_id === profile.id)
  );

  const handleAdd = () => {
    if (selectedProfileId) {
      addResponsible({ equipmentId, profileId: selectedProfileId });
      setSelectedProfileId("");
    }
  };

  if (isLoading) {
    return <Skeleton className="h-8 w-24" />;
  }

  // Compact mode for table cells
  if (compact) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-auto p-1 gap-1">
            <Users className="w-3 h-3" />
            <span className="text-xs">
              {responsibles.length > 0 ? (
                responsibles.length === 1 ? (
                  `${responsibles[0].profile?.first_name} ${responsibles[0].profile?.last_name}`
                ) : (
                  `${responsibles.length} osob`
                )
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Odpovědné osoby{equipmentName && ` – ${equipmentName}`}</DialogTitle>
          </DialogHeader>
          <ResponsiblesContent
            responsibles={responsibles}
            unassignedProfiles={unassignedProfiles}
            selectedProfileId={selectedProfileId}
            setSelectedProfileId={setSelectedProfileId}
            handleAdd={handleAdd}
            removeResponsible={removeResponsible}
            isAdding={isAdding}
            isRemoving={isRemoving}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Full mode for detail pages
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4" />
          Odpovědné osoby
        </h3>
      </div>
      <ResponsiblesContent
        responsibles={responsibles}
        unassignedProfiles={unassignedProfiles}
        selectedProfileId={selectedProfileId}
        setSelectedProfileId={setSelectedProfileId}
        handleAdd={handleAdd}
        removeResponsible={removeResponsible}
        isAdding={isAdding}
        isRemoving={isRemoving}
      />
    </div>
  );
}

interface ResponsiblesContentProps {
  responsibles: any[];
  unassignedProfiles: any[];
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  handleAdd: () => void;
  removeResponsible: (id: string) => void;
  isAdding: boolean;
  isRemoving: boolean;
}

function ResponsiblesContent({
  responsibles,
  unassignedProfiles,
  selectedProfileId,
  setSelectedProfileId,
  handleAdd,
  removeResponsible,
  isAdding,
  isRemoving,
}: ResponsiblesContentProps) {
  return (
    <div className="space-y-4">
      {/* Current responsibles */}
      <div className="flex flex-wrap gap-2">
        {responsibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Zatím nebyla přiřazena žádná odpovědná osoba
          </p>
        ) : (
          responsibles.map((resp) => (
            <Badge
              key={resp.id}
              variant="secondary"
              className="flex items-center gap-2 py-1.5 px-3"
            >
              <span>
                {resp.profile?.first_name} {resp.profile?.last_name}
              </span>
              <button
                onClick={() => removeResponsible(resp.id)}
                disabled={isRemoving}
                className="hover:text-destructive transition-colors"
                title="Odebrat osobu"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))
        )}
      </div>

      {/* Add new responsible */}
      {unassignedProfiles.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Vyberte osobu..." />
            </SelectTrigger>
            <SelectContent>
              {unassignedProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.first_name} {profile.last_name} ({profile.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!selectedProfileId || isAdding}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Přidat
          </Button>
        </div>
      )}

      {unassignedProfiles.length === 0 && responsibles.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Všichni dostupní uživatelé jsou již přiřazeni
        </p>
      )}
    </div>
  );
}
