import { useEquipmentResponsibles } from "@/hooks/useEquipmentResponsibles";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface EquipmentResponsiblesBadgesProps {
  equipmentId: string;
}

export function EquipmentResponsiblesBadges({ equipmentId }: EquipmentResponsiblesBadgesProps) {
  const { responsibles, isLoading } = useEquipmentResponsibles(equipmentId);

  if (isLoading) {
    return <Skeleton className="h-5 w-16" />;
  }

  if (responsibles.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Show up to 2 names, then +N more
  const displayCount = 2;
  const displayedResponsibles = responsibles.slice(0, displayCount);
  const remainingCount = responsibles.length - displayCount;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {displayedResponsibles.map((resp) => (
        <Badge key={resp.id} variant="secondary" className="text-xs py-0.5 px-1.5">
          {resp.profile?.first_name?.[0]}{resp.profile?.last_name?.[0]}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge variant="outline" className="text-xs py-0.5 px-1.5">
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
}
