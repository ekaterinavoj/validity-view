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
