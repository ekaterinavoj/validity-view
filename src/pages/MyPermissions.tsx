import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RolePermissionsInfo } from "@/components/RolePermissionsInfo";
import { Button } from "@/components/ui/button";
import { Shield, Users, User, Check, X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

type AppRole = "admin" | "manager" | "user";
type AppModule = "trainings" | "deadlines" | "plp";

interface RouteEntry {
  path: string;
  label: string;
  group: string;
  requiredRoles?: AppRole[];
  requiredModule?: AppModule;
}

/**
 * Mirror of routes defined in App.tsx — single source of truth for the audit page.
 * Keep in sync when adding new routes.
 */
const ROUTES: RouteEntry[] = [
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

  // Documents & profile (open to all approved users)
  { path: "/documents", label: "Dokumenty", group: "Dokumenty a profil" },
  { path: "/profile", label: "Můj profil", group: "Dokumenty a profil" },

  // System
  { path: "/audit-log", label: "Audit log", group: "Systém", requiredRoles: ["admin"] },
  { path: "/admin/settings", label: "Administrace", group: "Systém", requiredRoles: ["admin"] },
  { path: "/admin/status", label: "Stav systému", group: "Systém", requiredRoles: ["admin"] },
  { path: "/admin/migrations", label: "Migrace databáze", group: "Systém", requiredRoles: ["admin"] },
];

/**
 * Pure helper — also used by route-access tests. Mirrors ProtectedRoute logic.
 */
export function canAccessRoute(
  entry: RouteEntry,
  ctx: { isAdmin: boolean; roles: AppRole[]; modules: AppModule[] }
): boolean {
  if (entry.requiredRoles && entry.requiredRoles.length > 0) {
    if (!entry.requiredRoles.some((r) => ctx.roles.includes(r))) return false;
  }
  if (entry.requiredModule) {
    if (!ctx.isAdmin && !ctx.modules.includes(entry.requiredModule)) return false;
  }
  return true;
}

const MyPermissions = () => {
  const { roles, moduleAccess, isAdmin, profile } = useAuth();

  const ctx = { isAdmin, roles, modules: moduleAccess };
  const grouped = ROUTES.reduce<Record<string, RouteEntry[]>>((acc, r) => {
    (acc[r.group] ||= []).push(r);
    return acc;
  }, {});

  const primaryRoleLabel = isAdmin
    ? "Administrátor"
    : roles.includes("manager")
      ? "Manažer"
      : "Uživatel";
  const RoleIcon = isAdmin ? Shield : roles.includes("manager") ? Users : User;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RoleIcon className="w-5 h-5" />
            Moje oprávnění
          </CardTitle>
          <CardDescription>
            Přehled vaší aktuální role, přiřazených modulů a stránek, ke kterým
            máte (či nemáte) přístup. Přístupy upravuje administrátor v sekci
            Administrace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Účet</p>
              <p className="text-sm font-medium">
                {profile?.first_name} {profile?.last_name} · {profile?.email}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {primaryRoleLabel}
              </Badge>
              {roles.length > 1 && roles.map((r) => (
                <Badge key={r} variant="outline" className="text-xs">
                  {r}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Přiřazené moduly událostí</p>
            <div className="flex flex-wrap gap-2">
              {(["trainings", "deadlines", "plp"] as AppModule[]).map((m) => {
                const has = isAdmin || moduleAccess.includes(m);
                const label = m === "trainings" ? "Školení" : m === "deadlines" ? "Technické události" : "PLP";
                return (
                  <Badge
                    key={m}
                    variant="outline"
                    className={has ? "bg-success/10 text-success border-success/30" : "text-muted-foreground"}
                  >
                    {has ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                    {label}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stránky a moje přístupy</CardTitle>
          <CardDescription>
            Zelené odkazy můžete otevřít, šedé jsou pro vaši roli/moduly skryté.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(grouped).map(([group, entries]) => (
            <div key={group} className="space-y-2">
              <h4 className="text-sm font-semibold">{group}</h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {entries.map((e) => {
                  const allowed = canAccessRoute(e, ctx);
                  return (
                    <li
                      key={e.path}
                      className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${
                        allowed ? "bg-card" : "bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {allowed ? (
                        <Check className="w-4 h-4 text-success shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{e.label}</span>
                      {allowed ? (
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                          <Link to={e.path}>
                            Otevřít
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs">Bez přístupu</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <RolePermissionsInfo />
    </div>
  );
};

export default MyPermissions;

// Exported route catalog for tests
export const ROUTE_CATALOG = ROUTES;
