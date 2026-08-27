import { SlidersHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PeriodOverrideIconProps {
  overrideDays: number | null | undefined;
  typeDays: number | null | undefined;
  className?: string;
}

/**
 * Small badge shown in listing rows when a record uses its own periodicity
 * instead of the periodicity defined on the record type.
 */
export function PeriodOverrideIcon({ overrideDays, typeDays, className }: PeriodOverrideIconProps) {
  if (overrideDays == null) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 h-5 w-5",
              className,
            )}
            aria-label="Vlastní periodicita"
          >
            <SlidersHorizontal className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            Vlastní periodicita: <strong>{overrideDays}</strong> dní
            {typeDays != null && (
              <> (typ má {typeDays})</>
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface PeriodOverrideInfoProps {
  overrideDays: number | null | undefined;
  typeDays: number | null | undefined;
  className?: string;
}

/**
 * Inline info text used inside expandable row details / edit forms.
 */
export function PeriodOverrideInfo({ overrideDays, typeDays, className }: PeriodOverrideInfoProps) {
  if (overrideDays == null) return null;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300",
        className,
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
      <span>
        Tento záznam používá <strong>vlastní periodicitu {overrideDays} dní</strong>
        {typeDays != null && (
          <> (typ má {typeDays} dní)</>
        )}.
      </span>
    </div>
  );
}
