/**
 * Shared utilities for CSV import validation across all bulk-import components.
 *
 * Provides:
 *  - Header validation (required columns present, with Czech ↔ English aliases)
 *  - Per-row error CSV download (all error rows + reason in `_chyba` column)
 *  - Standardized error filename via buildExportFilename
 */
import Papa from "papaparse";
import { buildExportFilename } from "./exportFilename";

export interface HeaderCheckResult {
  /** True when all required columns (or one of their aliases) are present. */
  ok: boolean;
  /** Headers that are missing from the file. */
  missing: string[];
  /** All raw headers detected in the file. */
  detected: string[];
}

/**
 * Verify that the imported CSV has all required columns.
 *
 * @param headers Headers detected in the imported file
 * @param required Map of canonical name → list of acceptable aliases
 *                 (e.g. { "Email": ["Email", "email", "E-mail"] })
 */
export function checkRequiredHeaders(
  headers: string[],
  required: Record<string, string[]>,
): HeaderCheckResult {
  const normalized = headers.map((h) => h.trim());
  const missing: string[] = [];

  for (const [canonical, aliases] of Object.entries(required)) {
    const found = aliases.some((alias) =>
      normalized.some((h) => h.toLowerCase() === alias.toLowerCase()),
    );
    if (!found) missing.push(canonical);
  }

  return { ok: missing.length === 0, missing, detected: normalized };
}

/**
 * Generic per-row error descriptor used across all bulk imports.
 */
export interface ImportErrorRow {
  /** 1-based row number in the original file (header = row 1). */
  rowNumber: number;
  /** Human-readable error message in Czech. */
  reason: string;
  /** Raw row data — exported as-is so the user can fix and re-upload. */
  data: Record<string, any>;
}

/**
 * Download an "errors" CSV containing all failed rows with a `_chyba` column
 * appended. The user can fix the errors and re-import the file directly.
 *
 * @param module Module slug used in the filename (e.g. "skoleni-chyby")
 * @param errors List of error rows
 */
export function downloadErrorCSV(module: string, errors: ImportErrorRow[]): void {
  if (errors.length === 0) return;

  // Collect all unique columns across error rows (preserving first-seen order)
  const seenCols = new Set<string>();
  const colOrder: string[] = [];
  for (const err of errors) {
    for (const key of Object.keys(err.data)) {
      if (!seenCols.has(key)) {
        seenCols.add(key);
        colOrder.push(key);
      }
    }
  }

  const rows = errors.map((err) => {
    const out: Record<string, any> = { "Řádek": err.rowNumber };
    for (const col of colOrder) {
      out[col] = err.data[col] ?? "";
    }
    out["_chyba"] = err.reason;
    return out;
  });

  const csv = Papa.unparse(rows, { delimiter: ";" });
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", buildExportFilename(`${module}-chyby`));
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
