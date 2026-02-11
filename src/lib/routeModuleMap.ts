/**
 * Centralized route-to-module mapping.
 *
 * Every route in App.tsx should either:
 *  - start with a module prefix (/trainings, /deadlines, /plp) → auto-detected
 *  - appear in LEGACY_TRAINING_ROUTES (old paths kept for backwards compat)
 *  - be absent from this map → treated as a "global" page (no module switch)
 *
 * Adding a new route? If it belongs to a module, either:
 *  1. Use the module prefix (preferred), or
 *  2. Add the path to LEGACY_TRAINING_ROUTES below.
 *
 * Global pages (profile, audit-log, admin/*, user-management, employees,
 * facilities, statistics, departments, inactive) intentionally do NOT
 * appear here so they preserve the last-selected-module.
 */

export type AppModule = "trainings" | "deadlines" | "plp";

/**
 * Legacy training routes that don't follow the /trainings/* prefix.
 * These exist for backwards compatibility and should eventually be migrated.
 */
const LEGACY_TRAINING_ROUTES: string[] = [
  "/scheduled-trainings",
  "/new-training",
  "/history",          // legacy /history (not /trainings/history)
];

/** Prefixes that match /edit-training/:id */
const LEGACY_TRAINING_PREFIXES: string[] = [
  "/edit-training",
];

/**
 * Determines which module a given pathname belongs to.
 * Returns null for global/shared pages that don't belong to any module.
 */
export function getModuleFromPath(pathname: string): AppModule | null {
  // Prefix-based detection (canonical routes)
  if (pathname.startsWith("/trainings")) return "trainings";
  if (pathname.startsWith("/deadlines")) return "deadlines";
  if (pathname.startsWith("/plp")) return "plp";

  // Legacy training routes (exact match)
  if (LEGACY_TRAINING_ROUTES.includes(pathname)) return "trainings";

  // Legacy training routes (prefix match, e.g. /edit-training/:id)
  if (LEGACY_TRAINING_PREFIXES.some((p) => pathname.startsWith(p))) return "trainings";

  // Everything else is global (no module switch)
  return null;
}
