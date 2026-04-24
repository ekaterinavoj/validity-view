/**
 * Centralized helper for generating CSV export filenames.
 *
 * Standard format across the entire app: `{module}_{YYYY-MM-DD}.csv`
 * - Lowercase module slug (no diacritics, no spaces)
 * - ISO date in YYYY-MM-DD format (today by default)
 * - .csv extension always appended
 *
 * All CSV exports MUST use this helper to keep filenames consistent
 * across roles (admin/manager/user) and pages.
 *
 * Examples:
 *   buildExportFilename("skoleni")              → "skoleni_2026-04-24.csv"
 *   buildExportFilename("plp")                  → "plp_2026-04-24.csv"
 *   buildExportFilename("zarizeni")             → "zarizeni_2026-04-24.csv"
 *   buildExportFilename("matice-skoleni")       → "matice-skoleni_2026-04-24.csv"
 */
export function buildExportFilename(module: string, date: Date = new Date()): string {
  const slug = module
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${slug}_${y}-${m}-${d}.csv`;
}

/**
 * Standard tooltip describing CSV export format. Use as `title` attribute
 * on export/import buttons across the app.
 */
export const CSV_FORMAT_TOOLTIP =
  "Formát: CSV (oddělovač středník, kódování UTF-8 s BOM, kompatibilní s Excelem)";

/**
 * Standard tooltip for import buttons.
 */
export const CSV_IMPORT_TOOLTIP =
  "Nahrát CSV soubor (oddělovač středník, kódování UTF-8). Hlavičky musí odpovídat exportu.";
