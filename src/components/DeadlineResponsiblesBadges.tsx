import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, User } from "lucide-react";

interface Responsible {
  type: "user" | "group";
  id: string;
  name: string;
}

interface DeadlineResponsiblesBadgesProps {
  deadlineId: string;
  maxDisplay?: number;
  /** Pre-loaded responsibles from batch hook. If provided, skips per-row fetch. */
  responsibles?: Responsible[];
}

export function DeadlineResponsiblesBadges({ 
  deadlineId, 
  maxDisplay = 2,
  responsibles,
}: DeadlineResponsiblesBadgesProps) {
  if (!responsibles) {
    return <span className="text-xs text-muted-foreground">...</span>;
  }

  if (responsibles.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const displayed = responsibles.slice(0, maxDisplay);
  const remaining = responsibles.length - maxDisplay;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1">
        {displayed.map((r) => (
          <Tooltip key={`${r.type}-${r.id}`}>
            <TooltipTrigger asChild>
              <Badge 
                variant={r.type === "group" ? "secondary" : "outline"} 
                className="text-xs flex items-center gap-1 max-w-[120px]"
              >
                {r.type === "group" ? (
                  <Users className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <User className="w-3 h-3 flex-shrink-0" />
                )}
                <span className="truncate">{r.name}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{r.type === "group" ? "Skupina: " : "Osoba: "}{r.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs">
                +{remaining}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {responsibles.slice(maxDisplay).map((r) => (
                  <p key={`${r.type}-${r.id}`}>
                    {r.type === "group" ? "Skupina: " : ""}{r.name}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
