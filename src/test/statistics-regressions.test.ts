/**
 * Regression tests for the three Statistics page bugs fixed in
 * migration 20260424140000_ui_statistics_page_bugfixes.
 *
 * If any of these assertions ever flip, the corresponding bug has come back.
 */
import { describe, it, expect } from "vitest";
import {
  parseYearFromISO,
  parseMonthFromISO,
  isInYear,
  buildDepartmentLabel,
  computeAvgAttempts,
  formatAvgAttempts,
  formatStatCount,
} from "@/lib/statisticsHelpers";

describe("Statistics regression — Bug 1: year parsing must be timezone-safe", () => {
  it("returns the literal year prefix from an ISO date string", () => {
    expect(parseYearFromISO("2025-01-01")).toBe(2025);
    expect(parseYearFromISO("2024-12-31T23:30:00.000Z")).toBe(2024);
    expect(parseYearFromISO("2025-12-31T23:30:00+01:00")).toBe(2025);
  });

  it("does NOT shift years like new Date(...).getFullYear() can", () => {
    // Reproduce the bug: in many timezones, midnight on Jan 1 shifts back
    // into Dec 31 of the previous year. We must keep the literal year.
    const newYearsEve = "2025-01-01T00:00:00.000Z";
    expect(parseYearFromISO(newYearsEve)).toBe(2025);
  });

  it("handles null / undefined / malformed input gracefully", () => {
    expect(parseYearFromISO(null)).toBeNull();
    expect(parseYearFromISO(undefined)).toBeNull();
    expect(parseYearFromISO("")).toBeNull();
    expect(parseYearFromISO("not-a-date")).toBeNull();
    expect(parseYearFromISO("99-01-01")).toBeNull();
  });

  it("filters trainings into the correct year bucket", () => {
    const trainings = [
      { lastTrainingDate: "2024-12-31T23:30:00.000Z" },
      { lastTrainingDate: "2025-01-01T00:00:00.000Z" },
      { lastTrainingDate: "2025-06-15" },
      { lastTrainingDate: "2026-02-10" },
    ];
    const in2025 = trainings.filter((t) => isInYear(t.lastTrainingDate, 2025));
    expect(in2025).toHaveLength(2);
    expect(isInYear("2025-01-01", "2025")).toBe(true);
    expect(isInYear("2024-12-31", 2025)).toBe(false);
  });
});

describe("Statistics — month parsing must be timezone-safe", () => {
  it("returns 0-indexed month from ISO string", () => {
    expect(parseMonthFromISO("2025-01-15")).toBe(0);
    expect(parseMonthFromISO("2025-12-31")).toBe(11);
    expect(parseMonthFromISO("2025-06-15T00:00:00.000Z")).toBe(5);
  });

  it("does not drift across month boundaries", () => {
    // First minute of February — a naive Date.getMonth() in negative TZ
    // would yield 0 (January). We must stay on month 1 (February).
    expect(parseMonthFromISO("2025-02-01T00:00:00.000Z")).toBe(1);
  });

  it("returns null for invalid input", () => {
    expect(parseMonthFromISO(null)).toBeNull();
    expect(parseMonthFromISO("")).toBeNull();
    expect(parseMonthFromISO("2025")).toBeNull();
    expect(parseMonthFromISO("2025/01/01")).toBeNull();
    expect(parseMonthFromISO("2025-13-01")).toBeNull();
    expect(parseMonthFromISO("2025-00-01")).toBeNull();
  });
});
describe("Statistics regression — Bug 2: department label mapping", () => {
  it("renders human-readable name with code in parentheses", () => {
    expect(buildDepartmentLabel("2002000001", "LOG")).toBe("LOG (2002000001)");
  });

  it("never returns the raw code when a name is available", () => {
    const label = buildDepartmentLabel("2002000001", "Logistika");
    expect(label).not.toBe("2002000001");
    expect(label).not.toBe("2002000001 - Logistika");
    expect(label.startsWith("Logistika")).toBe(true);
  });

  it("falls back to the code when name is missing", () => {
    expect(buildDepartmentLabel("2002000001", "")).toBe("2002000001");
    expect(buildDepartmentLabel("2002000001", null)).toBe("2002000001");
  });

  it("returns 'Nezařazeno' when both code and name are missing", () => {
    expect(buildDepartmentLabel("", "")).toBe("Nezařazeno");
    expect(buildDepartmentLabel(null, null)).toBe("Nezařazeno");
    expect(buildDepartmentLabel(undefined, undefined)).toBe("Nezařazeno");
  });

  it("trims surrounding whitespace before joining", () => {
    expect(buildDepartmentLabel("  2002000001  ", "  LOG  ")).toBe(
      "LOG (2002000001)",
    );
  });
});

describe("Statistics regression — Bug 3: avg attempts on empty dataset", () => {
  it("returns 0 (NOT 1) when there are no successful deliveries", () => {
    expect(computeAvgAttempts([])).toBe(0);
  });

  it("computes the correct average for a non-empty dataset", () => {
    const successful = [
      { attempt_number: 1 },
      { attempt_number: 2 },
      { attempt_number: 3 },
    ];
    expect(computeAvgAttempts(successful)).toBe(2);
  });

  it("treats missing attempt_number as 1 (legacy logs)", () => {
    expect(computeAvgAttempts([{ attempt_number: null }, {}])).toBe(1);
  });

  it("never divides by zero", () => {
    expect(() => computeAvgAttempts([])).not.toThrow();
    expect(Number.isFinite(computeAvgAttempts([]))).toBe(true);
  });

  it("formatAvgAttempts shows '—' when both totals are zero", () => {
    expect(formatAvgAttempts(0, 0, 0)).toBe("—");
  });

  it("formatAvgAttempts formats a real value when there is data", () => {
    expect(formatAvgAttempts(1.4, 5, 0)).toBe("1.4");
    expect(formatAvgAttempts(2.34, 10, 2, 2)).toBe("2.34");
  });
});

describe("Statistics regression — empty-state count formatting", () => {
  it("returns '—' for breakdown counts when total records is 0", () => {
    expect(formatStatCount(0, 0)).toBe("—");
    expect(formatStatCount(5, 0)).toBe("—"); // defensive: hide stale numbers
  });

  it("returns the number as a string when there is data", () => {
    expect(formatStatCount(0, 10)).toBe("0");
    expect(formatStatCount(7, 10)).toBe("7");
  });
});
