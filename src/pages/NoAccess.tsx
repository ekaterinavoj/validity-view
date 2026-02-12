import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

const MODULE_LABELS: Record<string, string> = {
  trainings: "Školení",
  deadlines: "Technické události",
  plp: "PLP",
};

const NoAccess = () => {
  const navigate = useNavigate();
  const { signOut, loading, rolesLoaded, moduleAccessLoaded, moduleAccess, isAdmin } = useAuth();

  // If still loading, show spinner instead of error
  if (loading || !rolesLoaded || !moduleAccessLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user actually has access, redirect them (safety net)
  if (isAdmin || moduleAccess.length > 0) {
    // Use navigate with replace to go to the right module
    const firstModule = isAdmin ? "trainings" : moduleAccess[0];
    navigate(`/${firstModule}`, { replace: true });
    return null;
  }

  // Determine which modules are missing
  const allModules = ["trainings", "deadlines", "plp"];
  const missingModules = allModules.filter((m) => !moduleAccess.includes(m as any));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <ShieldX className="h-16 w-16 text-destructive mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-2">Žádný přístup k modulům</h1>
        <p className="text-muted-foreground mb-4">
          Váš účet nemá přiřazený přístup k žádnému modulu. Kontaktujte administrátora systému pro přidělení oprávnění.
        </p>
        {missingModules.length > 0 && (
          <div className="bg-muted rounded-lg p-3 mb-6 text-sm text-left">
            <p className="font-medium mb-1">Chybějící přístupy:</p>
            <ul className="list-disc list-inside text-muted-foreground">
              {missingModules.map((m) => (
                <li key={m}>{MODULE_LABELS[m] || m}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate("/profile")}>
            Můj profil
          </Button>
          <Button variant="destructive" onClick={signOut}>
            Odhlásit se
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NoAccess;
