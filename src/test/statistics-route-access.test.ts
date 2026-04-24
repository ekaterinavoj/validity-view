/**
 * Route-access coverage focused on the /statistics page.
 *
 * /statistics is one of the most sensitive read-only routes: it aggregates
 * data across all employees & trainings, so plain Users must never reach it.
 * These tests pin the access matrix so accidental loosening of guards in
 * App.tsx or routeAccess.ts will fail CI.
 */
import { describe, it, expect } from "vitest";
import { ROUTE_CATALOG, canAccessRoute } from "@/lib/routeAccess";

type AppRole = "admin" | "manager" | "user";
type AppModule = "trainings" | "deadlines" | "plp";

const ctx = (
  role: AppRole,
  modules: AppModule[] = [],
): { isAdmin: boolean; roles: AppRole[]; modules: AppModule[] } => ({
  isAdmin: role === "admin",
  roles: [role],
  modules,
});

const statisticsRoute = ROUTE_CATALOG.find((r) => r.path === "/statistics");

describe("/statistics route access", () => {
  it("is registered in the route catalog", () => {
    expect(statisticsRoute).toBeDefined();
  });

  it("requires admin or manager role (not module-gated)", () => {
    expect(statisticsRoute?.requiredRoles).toEqual(
      expect.arrayContaining(["admin", "manager"]),
    );
    expect(statisticsRoute?.requiredRoles).not.toContain("user");
    expect(statisticsRoute?.requiredModule).toBeUndefined();
  });

  it("allows admin", () => {
    expect(canAccessRoute(statisticsRoute!, ctx("admin"))).toBe(true);
  });

  it("allows manager regardless of module assignment", () => {
    expect(canAccessRoute(statisticsRoute!, ctx("manager", []))).toBe(true);
    expect(
      canAccessRoute(statisticsRoute!, ctx("manager", ["trainings"])),
    ).toBe(true);
    expect(
      canAccessRoute(
        statisticsRoute!,
        ctx("manager", ["trainings", "deadlines", "plp"]),
      ),
    ).toBe(true);
  });

  it("denies plain users — even ones with every module assigned", () => {
    expect(canAccessRoute(statisticsRoute!, ctx("user", []))).toBe(false);
    expect(
      canAccessRoute(statisticsRoute!, ctx("user", ["trainings"])),
    ).toBe(false);
    expect(
      canAccessRoute(
        statisticsRoute!,
        ctx("user", ["trainings", "deadlines", "plp"]),
      ),
    ).toBe(false);
  });

  it("denies users with no role at all (defensive)", () => {
    const empty = { isAdmin: false, roles: [] as AppRole[], modules: [] as AppModule[] };
    expect(canAccessRoute(statisticsRoute!, empty)).toBe(false);
  });
});
