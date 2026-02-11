import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const NoAccess = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <ShieldX className="h-16 w-16 text-destructive mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-2">Žádný přístup k modulům</h1>
        <p className="text-muted-foreground mb-6">
          Váš účet nemá přiřazený přístup k žádnému modulu. Kontaktujte administrátora systému pro přidělení oprávnění.
        </p>
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
