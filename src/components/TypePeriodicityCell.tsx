import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPeriodicity } from "@/lib/utils";

interface TypePeriodicityCellProps {
  typeName: string;
  periodDays?: number;
  description?: string;
}

export function TypePeriodicityCell({ typeName, description }: TypePeriodicityCellProps) {
  if (description) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help font-medium">{typeName}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <span className="font-medium">{typeName}</span>;
}

/**
 * Format periodicity in dual format: "každé 4 roky / 1460 dní"
 * Always shows both human-readable and raw days (unless unit is already days).
 */
export function formatPeriodicityDual(periodDays: number): string {
  const formatted = formatPeriodicity(periodDays);
  // If already in days (not convertible to months/years), no need to duplicate
  if (periodDays % 30 !== 0 && periodDays % 365 !== 0) {
    return formatted;
  }
  return `${formatted} / ${periodDays} dní`;
}
