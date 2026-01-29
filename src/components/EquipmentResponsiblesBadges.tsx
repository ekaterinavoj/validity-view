import { useEquipmentResponsibles } from "@/hooks/useEquipmentResponsibles";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 flex-wrap cursor-pointer">
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
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs">
          <div className="space-y-1.5">
            <p className="font-medium text-sm">Odpovědné osoby ({responsibles.length})</p>
            <ul className="space-y-1">
              {responsibles.map((resp) => (
                <li key={resp.id} className="text-sm">
                  <span className="font-medium">
                    {resp.profile?.first_name} {resp.profile?.last_name}
                  </span>
                  {resp.profile?.email && (
                    <span className="block text-xs text-muted-foreground">
                      {resp.profile.email}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
