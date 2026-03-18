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
