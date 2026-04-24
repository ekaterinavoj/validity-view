import { Check, X } from "lucide-react";
import { evaluatePassword, strengthLabel, strengthBarClass } from "@/lib/passwordStrength";
import { cn } from "@/lib/utils";

interface PasswordStrengthMeterProps {
  password: string;
  /** Optional: hide the per-rule checklist (only show the bar + label) */
  compact?: boolean;
}

export function PasswordStrengthMeter({ password, compact = false }: PasswordStrengthMeterProps) {
  const evalResult = evaluatePassword(password);

  if (!password) return null;

  const barColor = strengthBarClass(evalResult.strength);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Síla hesla</span>
          <span
            className={cn(
              "font-medium",
              evalResult.strength === "very_strong" || evalResult.strength === "strong"
                ? "text-[hsl(var(--status-valid-foreground))]"
                : evalResult.strength === "medium"
                ? "text-warning-foreground"
                : "text-destructive"
            )}
          >
            {strengthLabel(evalResult.strength)}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full transition-all duration-200", barColor)}
            style={{ width: `${Math.max(evalResult.percent, 5)}%` }}
            aria-label={`Síla hesla: ${strengthLabel(evalResult.strength)}`}
          />
        </div>
      </div>

      {!compact && (
        <ul className="space-y-1 text-xs">
          {Object.entries(evalResult.checks).map(([key, check]) => (
            <li key={key} className="flex items-center gap-1.5">
              {check.ok ? (
                <Check className="h-3.5 w-3.5 text-[hsl(var(--status-valid-foreground))]" />
              ) : (
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className={check.ok ? "text-foreground" : "text-muted-foreground"}>
                {check.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
