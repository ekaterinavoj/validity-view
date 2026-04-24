import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  loading?: boolean;
  /** Override label visible in tooltip. Default: 'Znovu načíst'. */
  label?: string;
  size?: "sm" | "default" | "icon";
}

/**
 * Standardized "Reload" button used across all overview pages.
 * Provides a manual fallback to Realtime subscriptions in case they fail
 * or the user wants to force a fresh fetch.
 */
export function RefreshButton({
  onRefresh,
  loading = false,
  label = "Znovu načíst",
  size = "sm",
}: RefreshButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size={size}
            onClick={() => onRefresh()}
            disabled={loading}
            aria-label={label}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {size !== "icon" && <span className="ml-2">{label}</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {label} – ručně obnoví data (záloha k automatické aktualizaci přes Realtime)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
