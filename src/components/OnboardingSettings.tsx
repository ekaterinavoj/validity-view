import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, UserPlus, Lock, CheckCircle, Users, Loader2 } from "lucide-react";

interface UserWithRole {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export function OnboardingSettings() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name");
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");
      
      const usersWithRoles = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          role: userRole?.role || "user",
        };
      }) || [];
      
      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin-only provisioning info */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Režim správy uživatelů
            <Badge className="bg-primary">Aktivní</Badge>
          </CardTitle>
          <CardDescription>
            Tento systém používá výhradně administrátorské zřizování uživatelů
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-background rounded-lg border">
            <Lock className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Pouze administrátor může vytvářet účty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Veřejná registrace ani registrace na pozvánku nejsou povoleny. 
                Všechny uživatelské účty vytváří administrátor v sekci <strong>Uživatelé</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-background rounded-lg border">
            <UserPlus className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Jak přidat nového uživatele</p>
              <ol className="text-sm text-muted-foreground mt-2 space-y-2 list-decimal list-inside">
                <li>Přejděte do záložky <strong>Uživatelé</strong></li>
                <li>Klikněte na tlačítko <strong>Přidat uživatele</strong></li>
                <li>Vyplňte email, jméno a vyberte zaměstnance</li>
                <li>Nastavte roli (Uživatel / Manažer / Administrátor)</li>
                <li>Vyberte moduly, ke kterým bude mít přístup</li>
                <li>Zadejte počáteční heslo nebo ho nechte vygenerovat</li>
                <li>Heslo předejte uživateli bezpečným způsobem</li>
              </ol>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-background rounded-lg border">
            <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Výhody tohoto režimu</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Plná kontrola nad tím, kdo má přístup do systému</li>
                <li>• Každý účet je od začátku správně propojen se zaměstnancem</li>
                <li>• Není nutné schvalovat registrace ani spravovat pozvánky</li>
                <li>• Administrátor má přehled o všech přístupech</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Přehled uživatelů a rolí
          </CardTitle>
          <CardDescription>
            Přehled všech uživatelů v systému. Pro změnu rolí a správu účtů použijte záložku "Uživatelé".
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant={user.role === "admin" ? "destructive" : user.role === "manager" ? "default" : "secondary"}>
                    {user.role === "admin" ? "Administrátor" : user.role === "manager" ? "Manažer" : "Uživatel"}
                  </Badge>
                </div>
              ))}
              
              {users.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Žádní uživatelé
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role permissions info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Přehled rolí a oprávnění
          </CardTitle>
          <CardDescription>
            Každá role má definovaná oprávnění pro práci s daty
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-destructive">Administrátor</Badge>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Plný přístup ke všem datům</li>
                <li>• Správa uživatelů a rolí</li>
                <li>• Nastavení systému</li>
                <li>• Přístup k audit logu</li>
                <li>• Všechny moduly automaticky</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-primary">Manažer</Badge>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Vidí svá data a data podřízených</li>
                <li>• Může vytvářet a editovat záznamy</li>
                <li>• Nemůže spravovat uživatele</li>
                <li>• Přístup k audit logu (čtení)</li>
                <li>• Moduly dle přidělení</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-secondary text-secondary-foreground">Uživatel</Badge>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Vidí pouze svá vlastní data</li>
                <li>• Může vytvářet záznamy</li>
                <li>• Omezené možnosti editace</li>
                <li>• Žádný přístup k administraci</li>
                <li>• Moduly dle přidělení</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
