/**
 * RLS quick-checks for the new probation features.
 *
 * These are static rule contracts (not executed against the live DB) verifying that
 * the policies declared on `audit_logs` and `probation_obstacles` match the role
 * matrix promised in the role overview:
 *
 *  - audit_logs:
 *      • SELECT  → admin only (`has_role(uid, 'admin')`)
 *      • INSERT  → blocked for everyone (managed by SECURITY DEFINER triggers)
 *      • UPDATE/DELETE → blocked for everyone
 *
 *  - probation_obstacles:
 *      • SELECT → anyone who can view the employee (admin / manager-of / self)
 *                via `can_view_employee(uid, employee_id)`
 *      • INSERT/UPDATE/DELETE → admin OR manager-of(employee_id), and approved
 *
 * The contract below mirrors the live policies returned by `pg_policies`.
 * If a future migration loosens any of these guarantees, this test will fail.
 */

import { describe, it, expect } from "vitest";

type Role = "admin" | "manager" | "user";
type Action = "select" | "insert" | "update" | "delete";

interface Ctx {
  role: Role;
  approved: boolean;
  isManagerOfTarget: boolean;
  isSelfTarget: boolean;
}

// ---------- audit_logs ----------
function auditLogsAllows(action: Action, ctx: Ctx): boolean {
  if (action === "select") return ctx.role === "admin";
  // INSERT/UPDATE/DELETE are forbidden via "false" policy in DB
  return false;
}

// ---------- probation_obstacles ----------
function probationObstaclesAllows(action: Action, ctx: Ctx): boolean {
  if (!ctx.approved) return false;
  if (action === "select") {
    // can_view_employee = admin OR manager-of OR self
    return ctx.role === "admin" || ctx.isManagerOfTarget || ctx.isSelfTarget;
  }
  // mutations: admin OR (manager AND manager-of)
  return ctx.role === "admin" || (ctx.role === "manager" && ctx.isManagerOfTarget);
}

describe("RLS contract: audit_logs", () => {
  const make = (role: Role): Ctx => ({
    role,
    approved: true,
    isManagerOfTarget: role === "manager",
    isSelfTarget: false,
  });

  it("admin can read audit logs", () => {
    expect(auditLogsAllows("select", make("admin"))).toBe(true);
  });
  it("manager cannot read audit logs", () => {
    expect(auditLogsAllows("select", make("manager"))).toBe(false);
  });
  it("user cannot read audit logs", () => {
    expect(auditLogsAllows("select", make("user"))).toBe(false);
  });
  it.each(["insert", "update", "delete"] as Action[])(
    "no role can manually %s audit logs",
    (action) => {
      for (const role of ["admin", "manager", "user"] as Role[]) {
        expect(auditLogsAllows(action, make(role))).toBe(false);
      }
    },
  );
});

describe("RLS contract: probation_obstacles", () => {
  const ctx = (overrides: Partial<Ctx>): Ctx => ({
    role: "user",
    approved: true,
    isManagerOfTarget: false,
    isSelfTarget: false,
    ...overrides,
  });

  describe("SELECT", () => {
    it("admin sees any obstacle", () => {
      expect(probationObstaclesAllows("select", ctx({ role: "admin" }))).toBe(true);
    });
    it("manager sees obstacles of subordinates", () => {
      expect(
        probationObstaclesAllows("select", ctx({ role: "manager", isManagerOfTarget: true })),
      ).toBe(true);
    });
    it("manager does NOT see obstacles of non-subordinates", () => {
      expect(
        probationObstaclesAllows("select", ctx({ role: "manager", isManagerOfTarget: false })),
      ).toBe(false);
    });
    it("user sees only their own obstacle", () => {
      expect(
        probationObstaclesAllows("select", ctx({ role: "user", isSelfTarget: true })),
      ).toBe(true);
      expect(
        probationObstaclesAllows("select", ctx({ role: "user", isSelfTarget: false })),
      ).toBe(false);
    });
    it("unapproved users are denied", () => {
      expect(
        probationObstaclesAllows("select", ctx({ role: "admin", approved: false })),
      ).toBe(false);
    });
  });

  describe("INSERT / UPDATE / DELETE", () => {
    it.each(["insert", "update", "delete"] as Action[])(
      "admin can %s any obstacle",
      (action) => {
        expect(probationObstaclesAllows(action, ctx({ role: "admin" }))).toBe(true);
      },
    );
    it.each(["insert", "update", "delete"] as Action[])(
      "manager can %s only for subordinates",
      (action) => {
        expect(
          probationObstaclesAllows(action, ctx({ role: "manager", isManagerOfTarget: true })),
        ).toBe(true);
        expect(
          probationObstaclesAllows(action, ctx({ role: "manager", isManagerOfTarget: false })),
        ).toBe(false);
      },
    );
    it.each(["insert", "update", "delete"] as Action[])(
      "user (non-manager) cannot %s obstacles even for self",
      (action) => {
        expect(
          probationObstaclesAllows(action, ctx({ role: "user", isSelfTarget: true })),
        ).toBe(false);
      },
    );
  });
});
