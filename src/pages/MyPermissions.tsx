import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RolePermissionsInfo } from "@/components/RolePermissionsInfo";
import { Button } from "@/components/ui/button";
import { Shield, Users, User, Check, X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTE_CATALOG, canAccessRoute, type AppModule, type RouteEntry } from "@/lib/routeAccess";

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
