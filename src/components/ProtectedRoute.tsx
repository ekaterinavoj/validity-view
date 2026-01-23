import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Clock, AlertTriangle, LogOut, ShieldX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layout } from "./Layout";

type RequiredRole = "admin" | "manager" | "user";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: RequiredRole[];
}

export const ProtectedRoute = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const {
    user,
    loading,
    profile,
    profileLoaded,
    profileError,
    isPending,
    roles,
    rolesLoaded,
    signOut,
    refreshProfile,
  } = useAuth();

  // Show loader while initial auth check is in progress
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Wait until profile is loaded (approval gating depends on it)
  if (!profileLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If profile couldn't be loaded, show a clear error instead of infinite spinner
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-destructive/5 p-4">
        <Card className="w-full max-w-md border-destructive/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Nepodařilo se načíst profil</CardTitle>
            <CardDescription className="text-base">
              {profileError || "Zkuste to prosím znovu."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={() => refreshProfile()}>
              Zkusit znovu
            </Button>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              <LogOut className="w-4 h-4 mr-2" />
              Odhlásit se
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If we have requiredRoles but roles haven't loaded yet, show loader
  if (requiredRoles && requiredRoles.length > 0 && !rolesLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show pending approval screen
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
              <Clock className="w-8 h-8 text-warning" />
            </div>
            <CardTitle className="text-xl">Čekání na schválení</CardTitle>
            <CardDescription className="text-base">
              Váš účet čeká na schválení administrátorem
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm">
                <strong>Email:</strong> {profile?.email}
              </p>
              <p className="text-sm">
                <strong>Jméno:</strong> {profile?.first_name} {profile?.last_name}
              </p>
            </div>
            
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Jakmile bude váš účet schválen, budete mít přístup do systému.
                Kontaktujte administrátora pro urychlení procesu.
              </p>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => signOut()}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Odhlásit se
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user was rejected
  if (profile?.approval_status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-destructive/5 p-4">
        <Card className="w-full max-w-md border-destructive/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Přístup zamítnut</CardTitle>
            <CardDescription className="text-base">
              Vaše žádost o přístup byla zamítnuta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Pokud si myslíte, že došlo k chybě, kontaktujte administrátora systému.
            </p>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => signOut()}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Odhlásit se
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check role-based access if requiredRoles is specified
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => roles.includes(role));
    
    if (!hasRequiredRole) {
      return (
        <Layout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-md border-destructive/20">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <ShieldX className="w-8 h-8 text-destructive" />
                </div>
                <CardTitle className="text-xl">Nedostatečná oprávnění</CardTitle>
                <CardDescription className="text-base">
                  Nemáte oprávnění k přístupu na tuto stránku
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Tato stránka vyžaduje vyšší úroveň oprávnění. Kontaktujte administrátora, pokud potřebujete přístup.
                </p>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.history.back()}
                >
                  Zpět
                </Button>
              </CardContent>
            </Card>
          </div>
        </Layout>
      );
    }
  }

  return <>{children}</>;
};
