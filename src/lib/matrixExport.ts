/**
 * Matrix XLSX export — Employees × Event types (training / medical examinations)
 *
 * Two modes:
 *   1. SIMPLE TRAINING MATRIX — only employee name, then training-type columns with ✓/✗
 *   2. PLP DETAIL EXPORT      — for examinations: name + last/next date + type + category + risks + result + note
 *
 * Cells in matrix mode are color-coded for fast visual scanning.
 * Used by ScheduledTrainings (matrix) and ScheduledExaminations (PLP detail) export buttons.
 */

import * as XLSX from "xlsx";

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

const STATE_FILL: Record<CellState, string | null> = {
  ok: "FFD1FAE5",
  warning: "FFD1FAE5",
  expired: "FFFEE2E2",
  missing: null,
  na: null,
};

const STATE_FONT: Record<CellState, string> = {
  ok: "FF065F46",
  warning: "FF065F46",
  expired: "FF991B1B",
  missing: "FF64748B",
  na: "FF64748B",
};

interface BuildTrainingMatrixArgs {
  filename: string;
  employees: MatrixEmployee[];
  eventTypes: MatrixEventType[];
  entries: MatrixEntry[];
}

/**
 * Simple training matrix:
 *  - Column A: "Zaměstnanec" (full name)
 *  - Columns B…: each training type (✓ has it, blank if not)
 */
export function downloadTrainingMatrixXLSX({
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
  const dataRows: any[][] = sortedEmployees.map((emp) => {
    const row: any[] = [emp.fullName];
    for (const t of sortedTypes) {
      const state = lookup.get(`${emp.id}|${t.id}`) ?? "missing";
      row.push(STATE_GLYPH[state]);
    }
    return row;
  });

  const aoa: any[][] = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [{ wch: 28 }, ...sortedTypes.map(() => ({ wch: 16 }))];
  ws["!freeze"] = { xSplit: 1, ySplit: 1 };
  (ws as any)["!panes"] = [{ ySplit: 1, xSplit: 1, state: "frozen" }];
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: sortedEmployees.length, c: headerRow.length - 1 },
    }),
  };

  const ref = ws["!ref"];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) continue;
        if (R === 0) {
          ws[addr].s = {
            font: { bold: true, color: { rgb: "FFFFFFFF" } },
            fill: { patternType: "solid", fgColor: { rgb: "FF1E3A8A" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: thinBorderAll(),
          };
        } else if (C === 0) {
          ws[addr].s = {
            font: { bold: true },
            alignment: { vertical: "center" },
            border: thinBorderAll(),
          };
        } else {
          const v = String(ws[addr].v ?? "");
          const state: CellState = v === "✓" ? "ok" : v === "✗" ? "expired" : "missing";
          ws[addr].s = {
            font: { bold: true, color: { rgb: STATE_FONT[state] } },
            fill: STATE_FILL[state]
              ? { patternType: "solid", fgColor: { rgb: STATE_FILL[state]! } }
              : undefined,
            alignment: { horizontal: "center", vertical: "center" },
            border: thinBorderAll(),
          };
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Matice školení");

  const safe = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safe, { cellStyles: true, bookType: "xlsx" });
}

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
export function downloadPLPDetailXLSX({ filename, rows }: BuildPLPDetailArgs): void {
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
  const aoa: any[][] = [headerRow, ...sorted.map((r) => [
    r.fullName,
    r.examinationDate,
    r.expiryDate,
    r.examinationType,
    r.workCategory,
    r.healthRisks,
    r.result,
    r.note,
  ])];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 26 },
    { wch: 16 },
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 32 },
    { wch: 22 },
    { wch: 40 },
  ];
  ws["!freeze"] = { xSplit: 1, ySplit: 1 };
  (ws as any)["!panes"] = [{ ySplit: 1, xSplit: 1, state: "frozen" }];
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: sorted.length, c: headerRow.length - 1 },
    }),
  };

  const ref = ws["!ref"];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) continue;
        if (R === 0) {
          ws[addr].s = {
            font: { bold: true, color: { rgb: "FFFFFFFF" } },
            fill: { patternType: "solid", fgColor: { rgb: "FF1E3A8A" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: thinBorderAll(),
          };
        } else {
          ws[addr].s = {
            alignment: { vertical: "center", wrapText: true },
            border: thinBorderAll(),
          };
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Přehled PLP");

  const safe = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safe, { cellStyles: true, bookType: "xlsx" });
}

function thinBorderAll() {
  const side = { style: "thin", color: { rgb: "FFCBD5E1" } };
  return { top: side, bottom: side, left: side, right: side };
}
