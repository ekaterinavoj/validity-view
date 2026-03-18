import {
  calculateNextDate,
  daysToPeriodicityUnit,
  type PeriodicityUnit,
} from "@/components/PeriodicityInput";

/**
 * Effective period logic: an explicit period on the record always overrides the type.
 * If the record period is empty/null, we fall back to the mandatory default period on the type.
 */
export function getEffectivePeriodDays(
  recordPeriodDays?: number | null,
  typePeriodDays?: number | null,
  fallbackDays = 365,
): number {
  return recordPeriodDays ?? typePeriodDays ?? fallbackDays;
}

export function calculateNextDateFromPeriodDays(
  startDate: Date,
  recordPeriodDays?: number | null,
  typePeriodDays?: number | null,
  fallbackDays = 365,
): Date {
  const effectivePeriodDays = getEffectivePeriodDays(recordPeriodDays, typePeriodDays, fallbackDays);
  const { value, unit } = daysToPeriodicityUnit(effectivePeriodDays);

  return calculateNextDate(startDate, value, unit);
}

export function getOverridePeriodicity(
  recordPeriodDays?: number | null,
  fallbackUnit: PeriodicityUnit = "years",
): { value: number | null; unit: PeriodicityUnit } {
  if (recordPeriodDays == null) {
    return { value: null, unit: fallbackUnit };
  }

  const { value, unit } = daysToPeriodicityUnit(recordPeriodDays);
  return { value, unit };
}
