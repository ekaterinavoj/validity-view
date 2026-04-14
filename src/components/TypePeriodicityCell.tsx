import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
 */
export function formatPeriodicityDual(periodDays: number): string {
  const { formatPeriodicity } = require("@/lib/utils");
  const formatted = formatPeriodicity(periodDays);
  if (periodDays % 365 === 0 || periodDays % 30 === 0) {
    return `${formatted} / ${periodDays} dní`;
  }
  return formatted;
}
