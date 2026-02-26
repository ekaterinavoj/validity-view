import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ResultValue = "passed" | "passed_with_reservations" | "failed";
export type ResultContext = "training" | "deadline";

interface ResultBadgeProps {
  result: ResultValue;
  context: ResultContext;
  note?: string;
  className?: string;
}

const resultLabels: Record<ResultContext, Record<ResultValue, string>> = {
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
};

export function getResultLabel(result: ResultValue, context: ResultContext): string {
  return resultLabels[context]?.[result] ?? result;
}

export function getResultOptions(context: ResultContext) {
  return [
    { value: "passed" as const, label: resultLabels[context].passed },
    { value: "passed_with_reservations" as const, label: resultLabels[context].passed_with_reservations },
    { value: "failed" as const, label: resultLabels[context].failed },
  ];
}

/** Returns true if the given result requires a mandatory comment */
export function resultRequiresComment(result: ResultValue): boolean {
  return result === "passed_with_reservations" || result === "failed";
}

export function ResultBadge({ result, context, note, className }: ResultBadgeProps) {
  const label = getResultLabel(result, context);
  const showWarningIcon = result === "passed_with_reservations";

  if (result === "failed") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-sm font-medium text-status-expired", className)}>
        {label}
      </span>
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
            <p className="text-sm">{note || "Bez komentáře"}</p>
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
