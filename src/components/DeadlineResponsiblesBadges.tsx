import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DeadlineResponsiblesBadgesProps {
  deadlineId: string;
  maxDisplay?: number;
}

interface Responsible {
  type: "user" | "group";
  id: string;
  name: string;
}

export function DeadlineResponsiblesBadges({ 
  deadlineId, 
  maxDisplay = 2 
}: DeadlineResponsiblesBadgesProps) {
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResponsibles = async () => {
      try {
        // Fetch direct profile responsibles
        const { data: profileResponsibles, error: profileError } = await supabase
          .from("deadline_responsibles")
          .select(`
            profile_id,
            profile:profiles(id, first_name, last_name)
          `)
          .eq("deadline_id", deadlineId)
          .not("profile_id", "is", null);

        if (profileError) throw profileError;

        // Fetch group responsibles
        const { data: groupResponsibles, error: groupError } = await supabase
          .from("deadline_responsibles")
          .select(`
            group_id,
            group:responsibility_groups(id, name)
          `)
          .eq("deadline_id", deadlineId)
          .not("group_id", "is", null);

        if (groupError) throw groupError;

        const results: Responsible[] = [];

        // Add profiles
        (profileResponsibles || []).forEach((r: any) => {
          if (r.profile) {
            const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
            if (profile) {
              results.push({
                type: "user",
                id: profile.id,
                name: `${profile.first_name} ${profile.last_name}`.trim(),
              });
            }
          }
        });

        // Add groups
        (groupResponsibles || []).forEach((r: any) => {
          if (r.group) {
            const group = Array.isArray(r.group) ? r.group[0] : r.group;
            if (group) {
              results.push({
                type: "group",
                id: group.id,
                name: group.name,
              });
            }
          }
        });

        setResponsibles(results);
      } catch (error) {
        console.error("Error loading deadline responsibles:", error);
      } finally {
        setLoading(false);
      }
    };

    loadResponsibles();
  }, [deadlineId]);

  if (loading) {
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
