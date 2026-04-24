/**
 * Pure helpers for the Statistics page. Extracted so that the timezone-safe
 * date logic and label mapping that fixed three production bugs can be locked
 * in by unit tests and reused consistently across tables and charts.
 *
 * Bugs guarded against:
 *  1) "Odškolené hodiny podle roků" was missing the current year because
 *     `new Date(isoDate).getFullYear()` shifts dates near midnight into the
 *     previous/next year depending on the runtime timezone.
 *  2) The "Školení podle oddělení" chart X axis showed raw inventory codes
 *     (e.g. "2002000001") instead of a human-readable department name.
 *  3) "Průměr pokusů" in the email delivery card showed 1.0 even when no
 *     emails had been sent (division of `0 / 0` defaulted to 1).
 */

/**
 * Extract the calendar year from an ISO-like date string ("YYYY-MM-DD..."),
 * a Date instance, or null/undefined. Always uses the literal year prefix
 * to avoid timezone drift — `new Date("2025-01-01").getFullYear()` can
 * return 2024 in negative offsets.
 *
 * Returns null when no parseable 4-digit year can be derived.
 */
export function parseYearFromISO(
  value: string | Date | null | undefined,
): number | null {
  if (value == null) return null;
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const head = raw.slice(0, 4);
  if (!/^\d{4}$/.test(head)) return null;
  const n = Number(head);
  return Number.isFinite(n) ? n : null;
}

/**
 * Boolean variant of {@link parseYearFromISO} for filter callbacks.
 */
export function isInYear(
  value: string | Date | null | undefined,
  year: string | number,
): boolean {
  const parsed = parseYearFromISO(value);
  if (parsed == null) return false;
  return String(parsed) === String(year);
}

/**
 * Extract the calendar month (0-11, Jan = 0) from an ISO-like date string,
 * without going through `new Date(...)` so the bucket cannot drift across
 * a month boundary in negative timezones. Returns null on bad input.
 */
export function parseMonthFromISO(
  value: string | Date | null | undefined,
): number | null {
  if (value == null) return null;
  const raw = value instanceof Date ? value.toISOString() : String(value);
  // Expect "YYYY-MM..." — characters 5..7 hold the 2-digit month.
  if (raw.length < 7 || raw[4] !== "-") return null;
  const head = raw.slice(5, 7);
  if (!/^\d{2}$/.test(head)) return null;
  const m = Number(head);
  if (!Number.isFinite(m) || m < 1 || m > 12) return null;
  return m - 1;
}

/**
 * Build a stable, user-facing department label for charts and groupings.
 * Prefers the human name and appends the code (which is often a long
 * inventory-style number) only as secondary context.
 *
 *   ("2002000001", "LOG")  -> "LOG (2002000001)"
 *   ("",           "LOG")  -> "LOG"
 *   ("2002000001", "")     -> "2002000001"
 *   ("",           "")     -> "Nezařazeno"
 */
export function buildDepartmentLabel(
  code: string | null | undefined,
  name: string | null | undefined,
): string {
  const c = (code ?? "").trim();
  const n = (name ?? "").trim();
  if (n && c) return `${n} (${c})`;
  if (n) return n;
  if (c) return c;
  return "Nezařazeno";
}

/**
 * Compute the average number of delivery attempts for successful emails.
 * Returns 0 when no successful records exist — callers should render a
 * dash ("—") in the UI when both sent and failed counts are zero so users
 * are not misled into thinking the average is "1 attempt".
 */
export function computeAvgAttempts(
  successful: ReadonlyArray<{ attempt_number?: number | null }>,
): number {
  if (!successful || successful.length === 0) return 0;
  const sum = successful.reduce(
    (acc, l) => acc + (l.attempt_number ?? 1),
    0,
  );
  return sum / successful.length;
}

/**
 * Format the avg-attempts value for display. Renders an em-dash when there
 * is no data at all (sent + failed === 0) so the UI never shows a misleading
 * "1.0" baseline against an empty dataset.
 */
export function formatAvgAttempts(
  avg: number,
  totalSent: number,
  totalFailed: number,
  fractionDigits = 1,
): string {
  if (totalSent + totalFailed === 0) return "—";
  return avg.toFixed(fractionDigits);
}

/**
 * Format a count for the Statistics summary cards. Returns "—" when the
 * total dataset is empty, so individual breakdown cards (valid / warning /
 * expired / unique employees) don't display a misleading "0" while the
 * page is showing the empty state above them.
 */
export function formatStatCount(value: number, totalRecords: number): string {
  if (totalRecords === 0) return "—";
  return String(value);
}
