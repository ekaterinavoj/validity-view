/**
 * Matrix CSV export — Employees × Event types (training / medical examinations)
 *
 * Two modes:
 *   1. SIMPLE TRAINING MATRIX — only employee name, then training-type columns with ✓/prázdné
 *   2. PLP DETAIL EXPORT      — for examinations: name + last/next date + type + category + risks + result + note
 *
 * Both modes export to CSV with UTF-8 BOM and ; delimiter (Excel-compatible).
 * Used by ScheduledTrainings (matrix) and ScheduledExaminations (PLP detail) export buttons.
 */

import Papa from "papaparse";

export type CellState = "ok" | "warning" | "expired" | "missing" | "na";

export interface MatrixEmployee {
  id: string;
  /** Full name "Surname Firstname" — used as single identifier column */
  fullName: string;
}

export interface MatrixEventType {
  id: string;
  name: string;
}

export interface MatrixEntry {
  employeeId: string;
  eventTypeId: string;
  state: CellState;
}

const STATE_GLYPH: Record<CellState, string> = {
  ok: "✓",
  warning: "✓",
  expired: "✗",
  missing: "",
  na: "",
};

interface BuildTrainingMatrixArgs {
  filename: string;
  employees: MatrixEmployee[];
  eventTypes: MatrixEventType[];
  entries: MatrixEntry[];
}

function downloadCsv(filename: string, csvContent: string): void {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Simple training matrix:
 *  - Column A: "Zaměstnanec" (full name)
 *  - Columns B…: each training type (✓ has it, blank if not)
 */
export function downloadTrainingMatrixCSV({
  filename,
  employees,
  eventTypes,
  entries,
}: BuildTrainingMatrixArgs): void {
  if (employees.length === 0 || eventTypes.length === 0) {
    throw new Error("Žádná data k exportu — vyberte alespoň jednoho zaměstnance a jeden typ školení.");
  }

  const lookup = new Map<string, CellState>();
  for (const e of entries) lookup.set(`${e.employeeId}|${e.eventTypeId}`, e.state);

  const sortedEmployees = [...employees].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, "cs"),
  );
  const sortedTypes = [...eventTypes].sort((a, b) => a.name.localeCompare(b.name, "cs"));

  const headerRow = ["Zaměstnanec", ...sortedTypes.map((t) => t.name)];
  const dataRows: string[][] = sortedEmployees.map((emp) => {
    const row: string[] = [emp.fullName];
    for (const t of sortedTypes) {
      const state = lookup.get(`${emp.id}|${t.id}`) ?? "missing";
      row.push(STATE_GLYPH[state]);
    }
    return row;
  });

  const csv = Papa.unparse([headerRow, ...dataRows], { delimiter: ";" });
  downloadCsv(filename, csv);
}

// Backwards-compatible alias (callers may have used the old XLSX name)
export const downloadTrainingMatrixXLSX = downloadTrainingMatrixCSV;

// ─────────────────────────────────────────────────────────────────
// PLP detailed export

export interface PLPDetailRow {
  fullName: string;
  examinationDate: string; // formatted dd.MM.yyyy
  expiryDate: string; // formatted dd.MM.yyyy
  examinationType: string;
  workCategory: string;
  healthRisks: string; // comma-separated active risks
  result: string;
  note: string;
}

interface BuildPLPDetailArgs {
  filename: string;
  rows: PLPDetailRow[];
}

/**
 * PLP detail export — one row per examination with:
 *  Jméno | Datum prohlídky | Konec platnosti | Typ prohlídky | Kategorie | Zdravotní rizika | Výsledek | Poznámka
 */
export function downloadPLPDetailCSV({ filename, rows }: BuildPLPDetailArgs): void {
  if (rows.length === 0) {
    throw new Error("Žádná data k exportu.");
  }

  const headerRow = [
    "Zaměstnanec",
    "Datum prohlídky",
    "Konec platnosti",
    "Typ prohlídky",
    "Kategorie práce",
    "Zdravotní rizika",
    "Výsledek",
    "Poznámka",
  ];
  const sorted = [...rows].sort((a, b) => a.fullName.localeCompare(b.fullName, "cs"));
  const dataRows = sorted.map((r) => [
    r.fullName,
    r.examinationDate,
    r.expiryDate,
    r.examinationType,
    r.workCategory,
    r.healthRisks,
    r.result,
    r.note,
  ]);

  const csv = Papa.unparse([headerRow, ...dataRows], { delimiter: ";" });
  downloadCsv(filename, csv);
}

// Backwards-compatible alias
export const downloadPLPDetailXLSX = downloadPLPDetailCSV;
