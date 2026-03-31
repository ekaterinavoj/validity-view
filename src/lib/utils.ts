import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formátuje periodicitu do správného českého tvaru
 * @param periodDays - počet dní periodicity
 * @returns Správně skloňovaný text, např. "každý 1 rok", "každé 2 roky", "každých 5 let"
 */
export function formatPeriodicity(periodDays: number): string {
  let value: number;
  let unit: string;
  let prefix: string;

  if (periodDays % 365 === 0) {
    value = Math.round(periodDays / 365);
    if (value === 1) { prefix = "každý"; unit = "rok"; }
    else if (value >= 2 && value <= 4) { prefix = "každé"; unit = "roky"; }
    else { prefix = "každých"; unit = "let"; }
  } else if (periodDays % 30 === 0) {
    value = Math.round(periodDays / 30);
    if (value === 1) { prefix = "každý"; unit = "měsíc"; }
    else if (value >= 2 && value <= 4) { prefix = "každé"; unit = "měsíce"; }
    else { prefix = "každých"; unit = "měsíců"; }
  } else {
    value = periodDays;
    if (value === 1) { prefix = "každý"; unit = "den"; }
    else if (value >= 2 && value <= 4) { prefix = "každé"; unit = "dny"; }
    else { prefix = "každých"; unit = "dnů"; }
  }

  return `${prefix} ${value} ${unit}`;
}

/**
 * Parsuje periodicitu z textu nebo čísla.
 * Akceptuje: číslo (dny), nebo český text jako "každé 4 roky", "každých 6 měsíců", "2 roky", "365" atd.
 * @returns počet dní nebo null pokud nelze parsovat
 */
export function parsePeriodicityText(raw: any): number | null {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Try plain number first
  const num = parseInt(str, 10);
  if (!isNaN(num) && num > 0 && String(num) === str) return num;

  // Parse Czech text: extract number and unit
  const match = str.match(/(\d+)\s*(rok[ůuy]?|let|rok|měsíc[eůi]?|měsíců|den|dn[ůíy]?|dní)/i);
  if (!match) {
    // Fallback: try extracting any number
    const numMatch = str.match(/(\d+)/);
    if (numMatch) {
      const val = parseInt(numMatch[1], 10);
      return val > 0 ? val : null;
    }
    return null;
  }

  const value = parseInt(match[1], 10);
  if (isNaN(value) || value <= 0) return null;

  const unitRaw = match[2].toLowerCase();
  if (/^(rok|roky|roků|let)$/.test(unitRaw)) return value * 365;
  if (/^(měsíc|měsíce|měsíci|měsíců)$/.test(unitRaw)) return value * 30;
  if (/^(den|dny|dní|dnů)$/.test(unitRaw)) return value;

  return null;
}
