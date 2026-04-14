import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { daysToPeriodicityUnit, formatPeriodicityDisplay } from "@/components/PeriodicityInput";

interface TypePeriodicityCellProps {
  typeName: string;
  periodDays: number;
  description?: string;
}

export function TypePeriodicityCell({ typeName, periodDays, description }: TypePeriodicityCellProps) {
  const { value, unit } = daysToPeriodicityUnit(periodDays);
  const formatted = formatPeriodicityDisplay(value, unit);
  const daysLabel = `${periodDays} dní`;
  const periodLabel = formatted !== daysLabel ? `${formatted} / ${daysLabel}` : daysLabel;

  const content = (
    <div className="flex flex-col">
      <span className="font-medium">{typeName}</span>
      <span className="text-xs text-muted-foreground">{periodLabel}</span>
    </div>
  );

  if (description) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{content}</div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
