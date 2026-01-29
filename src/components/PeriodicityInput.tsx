import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, addMonths, addYears } from "date-fns";

export type PeriodicityUnit = "days" | "months" | "years";

interface PeriodicityInputProps {
  value: number;
  unit: PeriodicityUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: PeriodicityUnit) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Converts value+unit to total days for storage in database
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
  // Check if it's a clean year value (divisible by 365)
  if (totalDays >= 365 && totalDays % 365 === 0) {
    return { value: totalDays / 365, unit: "years" };
  }
  // Check if it's a clean month value (divisible by 30)
  if (totalDays >= 30 && totalDays % 30 === 0) {
    return { value: totalDays / 30, unit: "months" };
  }
  // Default to days
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
 * Format periodicity for display in tables ("každé 2 roky", "každých 6 měsíců"...)
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
  // days
  if (value === 1) return "každý 1 den";
  if (value >= 2 && value <= 4) return `každé ${value} dny`;
  return `každých ${value} dnů`;
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
}: PeriodicityInputProps) {
  return (
    <div className="space-y-2">
      <Label>
        {label} {required && "*"}
      </Label>
      <div className="flex gap-2">
        <Input
          type="number"
          min="1"
          value={value}
          onChange={(e) => onValueChange(parseInt(e.target.value) || 1)}
          className="w-24"
          disabled={disabled}
        />
        <Select value={unit} onValueChange={(v) => onUnitChange(v as PeriodicityUnit)} disabled={disabled}>
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
      <p className="text-xs text-muted-foreground">
        = {periodicityToDays(value, unit)} dní celkem
      </p>
    </div>
  );
}
