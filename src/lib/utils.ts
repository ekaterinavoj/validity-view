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
    // Roky
    value = Math.round(periodDays / 365);
    if (value === 1) {
      prefix = "každý";
      unit = "rok";
    } else if (value >= 2 && value <= 4) {
      prefix = "každé";
      unit = "roky";
    } else {
      prefix = "každých";
      unit = "let";
    }
  } else if (periodDays % 30 === 0) {
    // Měsíce
    value = Math.round(periodDays / 30);
    if (value === 1) {
      prefix = "každý";
      unit = "měsíc";
    } else if (value >= 2 && value <= 4) {
      prefix = "každé";
      unit = "měsíce";
    } else {
      prefix = "každých";
      unit = "měsíců";
    }
  } else {
    // Dny
    value = periodDays;
    if (value === 1) {
      prefix = "každý";
      unit = "den";
    } else if (value >= 2 && value <= 4) {
      prefix = "každé";
      unit = "dny";
    } else {
      prefix = "každých";
      unit = "dnů";
    }
  }

  return `${prefix} ${value} ${unit}`;
}
