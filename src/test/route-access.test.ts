import { describe, it, expect } from "vitest";
import { ROUTE_CATALOG, canAccessRoute } from "@/pages/MyPermissions";

type AppRole = "admin" | "manager" | "user";
type AppModule = "trainings" | "deadlines" | "plp";

const ctx = (
  role: AppRole,
  modules: AppModule[] = []
): { isAdmin: boolean; roles: AppRole[]; modules: AppModule[] } => ({
  isAdmin: role === "admin",
  roles: [role],
  modules,
});

const findRoute = (path: string) => {
  const r = ROUTE_CATALOG.find((x) => x.path === path);
  if (!r) throw new Error(`Route ${path} missing from ROUTE_CATALOG`);
  return r;
};

describe("Route access — Admin", () => {
  // Admin's modules array is normally auto-filled in AuthContext, but the
  // canAccessRoute helper short-circuits requiredModule when isAdmin === true.
  const admin = ctx("admin", []);

  it.each([
    "/trainings",
    "/trainings/history",
    "/deadlines",
    "/deadlines/groups",
    "/plp",
    "/plp/new",
    "/plp/types",
    "/plp/history",
    "/employees",
    "/statistics",
    "/audit-log",
    "/admin/settings",
    "/admin/migrations",
    "/documents",
    "/profile",
  ])("can open %s", (path) => {
    expect(canAccessRoute(findRoute(path), admin)).toBe(true);
  });
});

describe("Route access — Manager", () => {
  // Manager is a typical real-world manager: modules trainings + deadlines, no PLP
  const manager = ctx("manager", ["trainings", "deadlines"]);

  it.each([
    "/trainings",
    "/trainings/history",
    "/deadlines",
    "/deadlines/groups",
    "/employees",
    "/statistics",
    "/event-types",
    "/training-types",
    "/documents",
    "/profile",
  ])("can open %s", (path) => {
    expect(canAccessRoute(findRoute(path), manager)).toBe(true);
  });

  it.each([
    "/audit-log",
    "/admin/settings",
    "/admin/status",
    "/admin/migrations",
    "/plp/new", // PLP create is admin-only
    "/plp", // not in plp module
    "/plp/history",
  ])("cannot open %s", (path) => {
    expect(canAccessRoute(findRoute(path), manager)).toBe(false);
  });
});

describe("Route access — User", () => {
  const user = ctx("user", ["trainings"]);

  it.each([
    "/trainings",
    "/trainings/new", // user can plan new training (RLS still applies)
    "/documents",
    "/profile",
  ])("can open %s", (path) => {
    expect(canAccessRoute(findRoute(path), user)).toBe(true);
  });

  it.each([
    "/trainings/history", // history is admin/manager only
    "/deadlines", // not in module
    "/plp", // not in module
    "/plp/new",
    "/plp/types",
    "/plp/history",
    "/employees",
    "/statistics",
    "/audit-log",
    "/admin/settings",
    "/admin/migrations",
    "/deadlines/groups",
  ])("cannot open %s", (path) => {
    expect(canAccessRoute(findRoute(path), user)).toBe(false);
  });
});

describe("Route access — User with no modules", () => {
  const orphan = ctx("user", []);

  it("cannot open any module page", () => {
    for (const path of ["/trainings", "/deadlines", "/plp"]) {
      expect(canAccessRoute(findRoute(path), orphan)).toBe(false);
    }
  });

  it("can still open Documents and Profile", () => {
    expect(canAccessRoute(findRoute("/documents"), orphan)).toBe(true);
    expect(canAccessRoute(findRoute("/profile"), orphan)).toBe(true);
  });
});

describe("PLP write protection", () => {
  it("manager with PLP module access still cannot create PLP examination", () => {
    const mgr = ctx("manager", ["plp"]);
    expect(canAccessRoute(findRoute("/plp/new"), mgr)).toBe(false);
    // But CAN view scheduled/types/history
    expect(canAccessRoute(findRoute("/plp"), mgr)).toBe(true);
    expect(canAccessRoute(findRoute("/plp/types"), mgr)).toBe(true);
    expect(canAccessRoute(findRoute("/plp/history"), mgr)).toBe(true);
  });

  it("user with PLP module access cannot reach types or history", () => {
    const usr = ctx("user", ["plp"]);
    expect(canAccessRoute(findRoute("/plp"), usr)).toBe(true);
    expect(canAccessRoute(findRoute("/plp/new"), usr)).toBe(false);
    expect(canAccessRoute(findRoute("/plp/types"), usr)).toBe(false);
    expect(canAccessRoute(findRoute("/plp/history"), usr)).toBe(false);
  });
});
