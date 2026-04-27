/**
 * Pure (no-React) catalog of application routes with their access requirements.
 *
 * This module is the single source of truth for role/module guards in the UI.
 * It is consumed by:
 *  - src/pages/MyPermissions.tsx (rendering "what I can open" page)
 *  - src/test/route-access.test.ts (asserting role × route matrix)
 *
 * Keep in sync with the actual <Route> definitions in src/App.tsx.
 */

export type AppRole = "admin" | "manager" | "user";
export type AppModule = "trainings" | "deadlines" | "plp";

export interface RouteEntry {
  path: string;
  label: string;
  group: string;
  requiredRoles?: AppRole[];
  requiredModule?: AppModule;
}

export const ROUTE_CATALOG: RouteEntry[] = [
  // Modules
  { path: "/trainings", label: "Naplánovaná školení", group: "Školení", requiredModule: "trainings" },
  { path: "/trainings/history", label: "Historie školení", group: "Školení", requiredRoles: ["admin", "manager"], requiredModule: "trainings" },
  { path: "/trainings/new", label: "Nové školení", group: "Školení", requiredModule: "trainings" },

  { path: "/deadlines", label: "Naplánované technické události", group: "Technické události", requiredModule: "deadlines" },
  { path: "/deadlines/history", label: "Historie tech. událostí", group: "Technické události", requiredRoles: ["admin", "manager"], requiredModule: "deadlines" },
  { path: "/deadlines/new", label: "Nová tech. událost", group: "Technické události", requiredModule: "deadlines" },
  { path: "/deadlines/equipment", label: "Zařízení", group: "Technické události", requiredModule: "deadlines" },
  { path: "/deadlines/types", label: "Typy tech. událostí", group: "Technické události", requiredModule: "deadlines" },
  { path: "/deadlines/groups", label: "Skupiny odpovědných", group: "Technické události", requiredRoles: ["admin", "manager"], requiredModule: "deadlines" },

  { path: "/plp", label: "Naplánované prohlídky (PLP)", group: "PLP", requiredModule: "plp" },
  { path: "/plp/new", label: "Nová prohlídka", group: "PLP", requiredRoles: ["admin"], requiredModule: "plp" },
  { path: "/plp/types", label: "Typy prohlídek", group: "PLP", requiredRoles: ["admin", "manager"], requiredModule: "plp" },
  { path: "/plp/history", label: "Historie prohlídek", group: "PLP", requiredRoles: ["admin", "manager"], requiredModule: "plp" },

  // Data management
  { path: "/employees", label: "Zaměstnanci", group: "Správa dat", requiredRoles: ["admin", "manager"] },
  { path: "/departments", label: "Střediska", group: "Správa dat", requiredRoles: ["admin", "manager"] },
  { path: "/facilities", label: "Provozovny", group: "Správa dat", requiredRoles: ["admin", "manager"] },
  { path: "/training-types", label: "Typy školení", group: "Správa dat", requiredRoles: ["admin", "manager"] },
  { path: "/event-types", label: "Přehled typů událostí", group: "Správa dat", requiredRoles: ["admin", "manager"] },
  { path: "/statistics", label: "Statistiky", group: "Správa dat", requiredRoles: ["admin", "manager"] },
  { path: "/inactive", label: "Pozastavená školení", group: "Správa dat", requiredRoles: ["admin", "manager"] },
  { path: "/probations", label: "Zkušební doby", group: "Správa dat", requiredRoles: ["admin", "manager"] },

  // Documents & profile (open to all approved users)
  { path: "/documents", label: "Dokumenty", group: "Dokumenty a profil" },
  { path: "/profile", label: "Můj profil", group: "Dokumenty a profil" },
  { path: "/profile?tab=permissions", label: "Moje oprávnění", group: "Dokumenty a profil" },

  // System
  { path: "/admin/settings?tab=audit-log", label: "Audit log", group: "Systém", requiredRoles: ["admin"] },
  { path: "/admin/settings", label: "Administrace", group: "Systém", requiredRoles: ["admin"] },
  { path: "/admin/status", label: "Stav systému", group: "Systém", requiredRoles: ["admin"] },
  { path: "/admin/migrations", label: "Migrace databáze", group: "Systém", requiredRoles: ["admin"] },
];

export interface AccessContext {
  isAdmin: boolean;
  roles: AppRole[];
  modules: AppModule[];
}

/**
 * Mirror of ProtectedRoute access logic. Pure, deterministic, side-effect-free
 * — safe to call in tests, render loops, and in non-DOM environments.
 */
export function canAccessRoute(entry: RouteEntry, ctx: AccessContext): boolean {
  if (entry.requiredRoles && entry.requiredRoles.length > 0) {
    if (!entry.requiredRoles.some((r) => ctx.roles.includes(r))) return false;
  }
  if (entry.requiredModule) {
    if (!ctx.isAdmin && !ctx.modules.includes(entry.requiredModule)) return false;
  }
  return true;
}
