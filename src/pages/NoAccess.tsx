import { ShieldX, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const MODULE_LABELS: Record<string, string> = {
  trainings: "Školení",
  deadlines: "Technické události",
  plp: "PLP",
};

interface QuickLink {
  to: string;
  label: string;
  variant?: "default" | "outline";
}

const NoAccess = () => {
  const navigate = useNavigate();
  const { signOut, loading, rolesLoaded, moduleAccessLoaded, moduleAccess, isAdmin, isManager } = useAuth();

  if (loading || !rolesLoaded || !moduleAccessLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Safety net: if user actually has access, redirect them
  if (isAdmin || moduleAccess.length > 0) {
    const firstModule = isAdmin ? "trainings" : moduleAccess[0];
    navigate(`/${firstModule}`, { replace: true });
    return null;
  }

  const allModules = ["trainings", "deadlines", "plp"] as const;
  const missingModules = allModules.filter((m) => !moduleAccess.includes(m));

  // Build quick-link list strictly from what THIS role can actually open
  const quickLinks: QuickLink[] = [
    { to: "/documents", label: "Firemní dokumenty", variant: "default" },
    { to: "/profile", label: "Můj profil", variant: "outline" },
    { to: "/my-permissions", label: "Moje oprávnění", variant: "outline" },
  ];
  if (isManager) {
    quickLinks.push(
      { to: "/employees", label: "Zaměstnanci", variant: "outline" },
      { to: "/statistics", label: "Statistiky", variant: "outline" },
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-lg px-6">
        <ShieldX className="h-16 w-16 text-destructive mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-2">Žádný přístup k modulům</h1>
        <p className="text-muted-foreground mb-4">
          Váš účet zatím nemá přiřazený přístup k žádnému z modulů událostí
          (Školení, Technické události, PLP). Kontaktujte prosím administrátora
          systému, který vám oprávnění přidělí.
        </p>

        {missingModules.length > 0 && (
          <div className="bg-muted rounded-lg p-3 mb-4 text-sm text-left">
            <p className="font-medium mb-1">Chybějící přístup k modulům:</p>
            <ul className="list-disc list-inside text-muted-foreground">
              {missingModules.map((m) => (
                <li key={m}>{MODULE_LABELS[m] || m}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-muted/40 rounded-lg p-3 mb-6 text-sm text-left">
          <p className="font-medium mb-2">Nejbližší povolené sekce:</p>
          <ul className="space-y-1.5">
            {quickLinks.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {l.label}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          {quickLinks.slice(0, 3).map((l) => (
            <Button
              key={l.to}
              variant={l.variant === "default" ? "default" : "outline"}
              onClick={() => navigate(l.to)}
            >
              {l.label}
            </Button>
          ))}
          <Button variant="destructive" onClick={signOut}>
            Odhlásit se
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NoAccess;
