import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ResultValue = "passed" | "passed_with_reservations" | "failed" | "lost_long_term";
export type ResultContext = "training" | "deadline" | "medical";

interface ResultBadgeProps {
  result: ResultValue;
  context: ResultContext;
  note?: string;
  className?: string;
}

const resultLabels: Record<ResultContext, Partial<Record<ResultValue, string>>> = {
  training: {
    passed: "Splněno",
    passed_with_reservations: "Splněno s výhradami",
    failed: "Nesplněno",
  },
  deadline: {
    passed: "Vyhovuje",
    passed_with_reservations: "Vyhovuje s výhradami",
    failed: "Nevyhovuje",
  },
  medical: {
    passed: "Zdravotně způsobilý / způsobilá",
    passed_with_reservations: "Zdravotně způsobilý / způsobilá s podmínkou",
    failed: "Není zdravotně způsobilý / způsobilá",
    lost_long_term: "Pozbyl(a) dlouhodobě zdravotní způsobilosti",
  },
};

export function getResultLabel(result: ResultValue, context: ResultContext): string {
  return resultLabels[context]?.[result] ?? result;
}

const tooltipMessages: Record<ResultContext, string> = {
  training: "Výsledek s výhradami — viz poznámka",
  deadline: "Vyhovuje s výhradami — viz poznámka",
  medical: "Způsobilost s podmínkou nebo omezením — viz poznámka",
};

export function getResultOptions(context: ResultContext) {
  return Object.entries(resultLabels[context])
    .filter(([, label]) => Boolean(label))
    .map(([value, label]) => ({ value: value as ResultValue, label: label as string }));
}

/** Returns true if the given result requires a mandatory comment */
export function resultRequiresComment(result: ResultValue): boolean {
  return result === "passed_with_reservations" || result === "failed";
}

export function ResultBadge({ result, context, note, className }: ResultBadgeProps) {
  const label = getResultLabel(result, context);
  const showWarningIcon = result === "passed_with_reservations";
  // For PLP: lost_long_term is rendered as positive + warning, NOT as a negative result.
  const isMedicalLostLongTerm = context === "medical" && result === "lost_long_term";
  const isNegativeResult = (result === "failed" || result === "lost_long_term") && !isMedicalLostLongTerm;

  if (isNegativeResult) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-sm font-medium text-status-expired", className)}>
        {label}
      </span>
    );
  }

  if (isMedicalLostLongTerm) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("inline-flex items-center gap-1 text-sm font-medium text-status-valid cursor-help flex-wrap", className)}>
              Zdravotně způsobilý / způsobilá
              <AlertTriangle className="w-4 h-4 text-status-warning" />
              <span className="text-status-warning">Pozbyl(a) dlouhodobě zdravotní způsobilosti</span>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">
              Zaměstnanec je zdravotně způsobilý a zároveň pozbyl(a) dlouhodobě zdravotní způsobilosti.
              {note ? ` ${note}` : ""}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (showWarningIcon) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("inline-flex items-center gap-1 text-sm font-medium text-status-valid cursor-help", className)}>
              {label}
              <AlertTriangle className="w-4 h-4 text-status-warning" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">{tooltipMessages[context]}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium text-status-valid", className)}>
      {label}
    </span>
  );
}
