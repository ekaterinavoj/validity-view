import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, addMonths, addYears } from "date-fns";

export type PeriodicityUnit = "days" | "months" | "years";

interface PeriodicityInputProps {
  value: number | null;
  unit: PeriodicityUnit;
  onValueChange: (value: number | null) => void;
  onUnitChange: (unit: PeriodicityUnit) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyHint?: string;
}

/**
 * Converts value+unit to total days for storage in database.
 * Note: For months (×30) and years (×365) this is an approximation.
 */
export function periodicityToDays(value: number, unit: PeriodicityUnit): number {
  switch (unit) {
    case "years":
      return value * 365;
    case "months":
      return value * 30;
    case "days":
    default:
      return value;
  }
}

/**
 * Converts total days to value+unit for display
 */
export function daysToPeriodicityUnit(totalDays: number): { value: number; unit: PeriodicityUnit } {
  if (totalDays >= 365 && totalDays % 365 === 0) {
    return { value: totalDays / 365, unit: "years" };
  }
  if (totalDays >= 30 && totalDays % 30 === 0) {
    return { value: totalDays / 30, unit: "months" };
  }
  return { value: totalDays, unit: "days" };
}

/**
 * Calculate next date from a start date using value+unit
 */
export function calculateNextDate(startDate: Date, value: number, unit: PeriodicityUnit): Date {
  switch (unit) {
    case "years":
      return addYears(startDate, value);
    case "months":
      return addMonths(startDate, value);
    case "days":
    default:
      return addDays(startDate, value);
  }
}

/**
 * Format periodicity for display in tables ("každý 1 rok", "každé 2 roky"...)
 */
export function formatPeriodicityDisplay(value: number, unit: PeriodicityUnit): string {
  if (unit === "years") {
    if (value === 1) return "každý 1 rok";
    if (value >= 2 && value <= 4) return `každé ${value} roky`;
    return `každých ${value} let`;
  }
  if (unit === "months") {
    if (value === 1) return "každý 1 měsíc";
    if (value >= 2 && value <= 4) return `každé ${value} měsíce`;
    return `každých ${value} měsíců`;
  }
  if (value === 1) return "každý 1 den";
  if (value >= 2 && value <= 4) return `každé ${value} dny`;
  return `každých ${value} dnů`;
}

/**
 * Format days count with correct Czech grammar (1 den, 2 dny, 5 dnů)
 */
export function formatDaysWithGrammar(days: number): string {
  const absDays = Math.abs(days);
  if (absDays === 1) return `${absDays} den`;
  if (absDays >= 2 && absDays <= 4) return `${absDays} dny`;
  return `${absDays} dnů`;
}

const UNIT_LABELS: Record<PeriodicityUnit, string> = {
  days: "Dní",
  months: "Měsíců",
  years: "Roků",
};

export function PeriodicityInput({
  value,
  unit,
  onValueChange,
  onUnitChange,
  label = "Periodicita",
  required = false,
  disabled = false,
  placeholder,
  emptyHint,
}: PeriodicityInputProps) {
  const [localValue, setLocalValue] = useState<string>(value == null ? "" : String(value));

  useEffect(() => {
    setLocalValue(value == null ? "" : String(value));
  }, [value]);

  const handleBlur = () => {
    const trimmed = localValue.trim();

    if (trimmed === "") {
      if (!required) {
        onValueChange(null);
        return;
      }

      setLocalValue("1");
      onValueChange(1);
      return;
    }

    const parsed = parseInt(trimmed, 10);
    if (!parsed || parsed < 1) {
      if (required) {
        setLocalValue("1");
        onValueChange(1);
      } else {
        setLocalValue("");
        onValueChange(null);
      }
    } else {
      setLocalValue(String(parsed));
      onValueChange(parsed);
    }
  };

  const totalDays = value != null && value >= 1 ? periodicityToDays(value, unit) : null;
  const isApproximate = unit !== "days";

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && "*"}
      </Label>
      <div className="flex gap-2">
        <Input
          type="number"
          min="1"
          value={localValue}
          placeholder={placeholder}
          onChange={(e) => {
            const nextValue = e.target.value;
            setLocalValue(nextValue);

            if (nextValue.trim() === "") {
              if (!required) {
                onValueChange(null);
              }
              return;
            }

            const parsed = parseInt(nextValue, 10);
            if (parsed && parsed >= 1) {
              onValueChange(parsed);
            }
          }}
          onBlur={handleBlur}
          className="w-24"
          disabled={disabled}
        />
        <Select
          value={unit}
          onValueChange={(v) => {
            const parsed = parseInt(localValue, 10);
            if (required && (!parsed || parsed < 1)) {
              setLocalValue("1");
              onValueChange(1);
            }
            onUnitChange(v as PeriodicityUnit);
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="days">{UNIT_LABELS.days}</SelectItem>
            <SelectItem value="months">{UNIT_LABELS.months}</SelectItem>
            <SelectItem value="years">{UNIT_LABELS.years}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {totalDays != null ? (
        <p className="text-xs text-muted-foreground">
          {isApproximate ? "≈ " : "= "}{totalDays} dní celkem
          {isApproximate && " (orientační)"}
        </p>
      ) : emptyHint ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : null}
    </div>
  );
}
