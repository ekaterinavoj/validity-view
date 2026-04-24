/**
 * Matrix XLSX export — Employees × Event types (training / medical examinations)
 *
 * Builds a wide spreadsheet where:
 *   - Rows = employees (department, last name, first name, position, status, manager)
 *   - Columns = each event type (training type or examination type)
 *   - Cells  = ✓ (valid), ⚠ (warning, expiring soon), ✗ (expired/missing), — (not applicable)
 *
 * Cells are color-coded for fast visual scanning. Includes:
 *   - Frozen first row + first 4 columns
 *   - AutoFilter on the header row
 *   - Summary row at the bottom counting ✓ / ⚠ / ✗ per column
 *   - "Legenda" sheet
 *
 * Used by ScheduledTrainings and ScheduledExaminations export buttons.
 */

import * as XLSX from "xlsx";

export type CellState = "ok" | "warning" | "expired" | "missing" | "na";

export interface MatrixEmployee {
  id: string;
  department: string; // formatted "100 - Výroba"
  lastName: string;
  firstName: string;
  position: string;
  statusLabel: string;
  managerName: string; // empty string if none
}

export interface MatrixEventType {
  id: string;
  name: string;
  facility: string;
}

export interface MatrixEntry {
  employeeId: string;
  eventTypeId: string;
  state: CellState;
}

const STATE_GLYPH: Record<CellState, string> = {
  ok: "✓",
  warning: "⚠",
  expired: "✗",
  missing: "✗",
  na: "—",
};

// AABBGGRR-like ARGB hex colors used by SheetJS for cell fill
const STATE_FILL: Record<CellState, string | null> = {
  ok: "FFD1FAE5", // green-100
  warning: "FFFEF3C7", // amber-100
  expired: "FFFEE2E2", // red-100
  missing: "FFFEE2E2", // red-100
  na: "FFF1F5F9", // slate-100
};

const STATE_FONT: Record<CellState, string> = {
  ok: "FF065F46", // green-800
  warning: "FF92400E", // amber-800
  expired: "FF991B1B", // red-800
  missing: "FF991B1B",
  na: "FF64748B", // slate-500
};

interface BuildArgs {
  /** "Matice školení" / "Matice prohlídek" */
  title: string;
  /** Filename without extension */
  filename: string;
  employees: MatrixEmployee[];
  eventTypes: MatrixEventType[];
  entries: MatrixEntry[];
  /** Localized column header for the events block (e.g. "Školení", "Prohlídky") */
  eventsLabel: string;
}

export function downloadMatrixXLSX({
  title,
  filename,
  employees,
  eventTypes,
  entries,
  eventsLabel,
}: BuildArgs): void {
  if (employees.length === 0 || eventTypes.length === 0) {
    throw new Error("Žádná data k exportu — vyberte alespoň jednoho zaměstnance a jeden typ události.");
  }

  // Build lookup map: `${empId}|${typeId}` -> state
  const lookup = new Map<string, CellState>();
  for (const e of entries) {
    lookup.set(`${e.employeeId}|${e.eventTypeId}`, e.state);
  }

  // Sort employees by department, then last name, first name (Czech locale)
  const sortedEmployees = [...employees].sort((a, b) => {
    const d = a.department.localeCompare(b.department, "cs");
    if (d !== 0) return d;
    const l = a.lastName.localeCompare(b.lastName, "cs");
    if (l !== 0) return l;
    return a.firstName.localeCompare(b.firstName, "cs");
  });

  // Sort event types by facility, then name
  const sortedTypes = [...eventTypes].sort((a, b) => {
    const f = a.facility.localeCompare(b.facility, "cs");
    if (f !== 0) return f;
    return a.name.localeCompare(b.name, "cs");
  });

  const FIXED_COLS = ["Středisko", "Příjmení", "Jméno", "Pozice", "Stav", "Nadřízený"];
  const headerRow = [...FIXED_COLS, ...sortedTypes.map((t) => t.name)];

  // Build data rows
  const dataRows: any[][] = sortedEmployees.map((emp) => {
    const row: any[] = [
      emp.department,
      emp.lastName,
      emp.firstName,
      emp.position,
      emp.statusLabel,
      emp.managerName,
    ];
    for (const t of sortedTypes) {
      const state = lookup.get(`${emp.id}|${t.id}`) ?? "na";
      row.push(STATE_GLYPH[state]);
    }
    return row;
  });

  // Summary row at bottom: count ✓ / ⚠ / ✗ per event type column
  const summaryRow: any[] = ["", "", "", "", "", "Celkem ✓ / ⚠ / ✗"];
  for (const t of sortedTypes) {
    let ok = 0,
      warn = 0,
      expired = 0;
    for (const emp of sortedEmployees) {
      const s = lookup.get(`${emp.id}|${t.id}`) ?? "na";
      if (s === "ok") ok++;
      else if (s === "warning") warn++;
      else if (s === "expired" || s === "missing") expired++;
    }
    summaryRow.push(`${ok} / ${warn} / ${expired}`);
  }

  const aoa: any[][] = [headerRow, ...dataRows, summaryRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  const colWidths = [
    { wch: 22 }, // Středisko
    { wch: 16 }, // Příjmení
    { wch: 14 }, // Jméno
    { wch: 22 }, // Pozice
    { wch: 14 }, // Stav
    { wch: 22 }, // Nadřízený
    ...sortedTypes.map(() => ({ wch: 14 })),
  ];
  ws["!cols"] = colWidths;

  // Freeze first row + first 6 columns
  ws["!freeze"] = { xSplit: FIXED_COLS.length, ySplit: 1 };
  // Older XLSX viewers use !panes
  (ws as any)["!panes"] = [{ ySplit: 1, xSplit: FIXED_COLS.length, state: "frozen" }];

  // Auto-filter on header row (full data range, excluding summary)
  const lastDataRow = sortedEmployees.length + 1; // +1 for header
  const lastCol = headerRow.length - 1;
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: lastDataRow, c: lastCol },
    }),
  };

  // Style cells: header bold, data cells colored by state, summary bold
  const ref = ws["!ref"];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) continue;

        if (R === 0) {
          // Header row
          ws[addr].s = {
            font: { bold: true, color: { rgb: "FFFFFFFF" } },
            fill: { patternType: "solid", fgColor: { rgb: "FF1E3A8A" } }, // blue-900
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: thinBorderAll(),
          };
        } else if (R === lastDataRow + 1) {
          // Summary row
          ws[addr].s = {
            font: { bold: true, color: { rgb: "FF1E293B" } },
            fill: { patternType: "solid", fgColor: { rgb: "FFE2E8F0" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: thinBorderAll(),
          };
        } else if (C >= FIXED_COLS.length) {
          // Event-type cell — colorize by glyph
          const v = String(ws[addr].v ?? "");
          const state: CellState =
            v === "✓" ? "ok" : v === "⚠" ? "warning" : v === "✗" ? "expired" : "na";
          ws[addr].s = {
            font: { bold: true, color: { rgb: STATE_FONT[state] } },
            fill: STATE_FILL[state]
              ? { patternType: "solid", fgColor: { rgb: STATE_FILL[state]! } }
              : undefined,
            alignment: { horizontal: "center", vertical: "center" },
            border: thinBorderAll(),
          };
        } else {
          // Fixed left columns
          ws[addr].s = {
            alignment: { vertical: "center", wrapText: true },
            border: thinBorderAll(),
          };
        }
      }
    }
  }

  // Build workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, truncateSheetName(title));

  // Legend sheet
  const legendAOA = [
    ["Symbol", "Význam", "Barva"],
    ["✓", "Platné — události má a nevyprší dříve než za 30 dní", "Zelená"],
    ["⚠", "Brzy vyprší — končí do 30 dní", "Oranžová"],
    ["✗", "Prošlé nebo zcela chybí", "Červená"],
    ["—", `Tento ${eventsLabel.toLowerCase()} se na zaměstnance nevztahuje`, "Šedá"],
    [],
    ["Souhrn ve spodním řádku:", "Počet ✓ / ⚠ / ✗ pro daný sloupec", ""],
    ["Filtrování", "Použijte AutoFilter v záhlaví pro zobrazení podmnožiny", ""],
    ["Pevné sloupce/řádek", "Záhlaví a prvních 6 sloupců zůstává viditelné při scrollu", ""],
  ];
  const legendWs = XLSX.utils.aoa_to_sheet(legendAOA);
  legendWs["!cols"] = [{ wch: 14 }, { wch: 70 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, legendWs, "Legenda");

  // Save
  const safe = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safe, { cellStyles: true, bookType: "xlsx" });
}

function thinBorderAll() {
  const side = { style: "thin", color: { rgb: "FFCBD5E1" } };
  return { top: side, bottom: side, left: side, right: side };
}

function truncateSheetName(name: string): string {
  // Excel limits sheet names to 31 chars
  return name.length > 31 ? name.slice(0, 31) : name;
}
