import { format, isValid, parseISO } from "date-fns";
import { cs } from "date-fns/locale";

type DateValue = Date | string | number | null | undefined;

function normalizeDate(value: DateValue): Date | null {
  if (value == null || value === "") {
    return null;
  }

  const parsed =
    value instanceof Date
      ? value
      : typeof value === "string"
        ? parseISO(value)
        : new Date(value);

  return isValid(parsed) ? parsed : null;
}

export function formatDisplayDate(value: DateValue, fallback = "—"): string {
  const date = normalizeDate(value);
  return date ? format(date, "dd.MM.yyyy", { locale: cs }) : fallback;
}

export function formatDisplayDateTime(value: DateValue, fallback = "—"): string {
  const date = normalizeDate(value);
  return date ? format(date, "dd.MM.yyyy HH:mm", { locale: cs }) : fallback;
}

/**
 * Calculate age from birth date using date parts only (no timezone issues).
 * Compares year/month/day to avoid off-by-one errors near birthdays.
 */
export function calculateAge(birthDateValue: DateValue): number | null {
  if (birthDateValue == null || birthDateValue === "") return null;

  // Extract date parts from the birth date string to avoid timezone shifts
  let birthYear: number, birthMonth: number, birthDay: number;

  if (typeof birthDateValue === "string" && /^\d{4}-\d{2}-\d{2}/.test(birthDateValue)) {
    // Parse date string directly to avoid timezone conversion
    const parts = birthDateValue.split("T")[0].split("-");
    birthYear = parseInt(parts[0], 10);
    birthMonth = parseInt(parts[1], 10);
    birthDay = parseInt(parts[2], 10);
  } else {
    const date = normalizeDate(birthDateValue);
    if (!date) return null;
    birthYear = date.getFullYear();
    birthMonth = date.getMonth() + 1;
    birthDay = date.getDate();
  }

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  let age = todayYear - birthYear;
  if (todayMonth < birthMonth || (todayMonth === birthMonth && todayDay < birthDay)) {
    age--;
  }

  return age >= 0 ? age : null;
}
