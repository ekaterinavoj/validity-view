/**
 * Czech grammar utilities for correct plural forms
 */

/**
 * Format days count with correct Czech grammar (1 den, 2 dny, 5 dnů)
 */
export function formatDays(days: number): string {
  const absDays = Math.abs(days);
  if (absDays === 1) return `${days} den`;
  if (absDays >= 2 && absDays <= 4) return `${days} dny`;
  return `${days} dnů`;
}

/**
 * Format days count with correct Czech grammar - only the unit (den/dny/dnů)
 */
export function formatDaysUnit(days: number): string {
  const absDays = Math.abs(days);
  if (absDays === 1) return "den";
  if (absDays >= 2 && absDays <= 4) return "dny";
  return "dnů";
}

/**
 * Format days with "po termínu" suffix for expired items
 */
export function formatDaysWithExpiry(days: number): string {
  const absDays = Math.abs(days);
  let unit: string;
  
  if (absDays === 1) {
    unit = "den";
  } else if (absDays >= 2 && absDays <= 4) {
    unit = "dny";
  } else {
    unit = "dnů";
  }
  
  if (days < 0) {
    return `${absDays} ${unit} po termínu`;
  }
  return `${absDays} ${unit}`;
}

/**
 * Format months count with correct Czech grammar (1 měsíc, 2 měsíce, 5 měsíců)
 */
export function formatMonths(months: number): string {
  const absMonths = Math.abs(months);
  if (absMonths === 1) return `${months} měsíc`;
  if (absMonths >= 2 && absMonths <= 4) return `${months} měsíce`;
  return `${months} měsíců`;
}

/**
 * Format years count with correct Czech grammar (1 rok, 2 roky, 5 let)
 */
export function formatYears(years: number): string {
  const absYears = Math.abs(years);
  if (absYears === 1) return `${years} rok`;
  if (absYears >= 2 && absYears <= 4) return `${years} roky`;
  return `${years} let`;
}

/**
 * Format "dní před vypršením" with correct grammar
 */
export function formatDaysBeforeExpiry(days: number): string {
  const absDays = Math.abs(days);
  if (absDays === 1) return `${absDays} den před vypršením`;
  if (absDays >= 2 && absDays <= 4) return `${absDays} dny před vypršením`;
  return `${absDays} dnů před vypršením`;
}
