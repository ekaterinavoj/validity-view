import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  position?: string;
  roles: string[];
}

const roleLabels = {
  admin: "Admin",
  manager: "Manažer",
  user: "Uživatel",
};

const roleColors = {
  admin: "bg-red-500/20 text-red-700 dark:text-red-300",
  manager: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  user: "bg-green-500/20 text-green-700 dark:text-green-300",
};

export default function UserManagement() {
  const { isAdmin, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      toast({
        title: "Přístup odepřen",
        description: "Nemáte oprávnění k této stránce.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    loadUsers();
  }, [isAdmin, navigate]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      // Load all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("last_name");

      if (profilesError) throw profilesError;

      // Load all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const usersWithRoles: UserProfile[] = (profilesData || []).map((profile) => ({
        ...profile,
        roles: rolesData?.filter((r) => r.user_id === profile.id).map((r) => r.role) || [],
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst uživatele.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      // Remove all existing roles for this user
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Add the new role
      const { error } = await supabase.from("user_roles").insert([{
        user_id: userId,
        role: newRole as "admin" | "manager" | "user",
        created_by: profile?.id,
      }]);

      if (error) throw error;

      toast({
        title: "Role aktualizována",
        description: "Role uživatele byla úspěšně změněna.",
      });

      loadUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se aktualizovat roli.",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Správa uživatelů a rolí
          </h2>
          <p className="text-muted-foreground mt-2">
            Spravujte role a oprávnění uživatelů v systému
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b">
            <UserCog className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Uživatelé systému</h3>
            <Badge variant="secondary">{users.length} uživatelů</Badge>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jméno</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Pozice</TableHead>
                  <TableHead>Aktuální role</TableHead>
                  <TableHead>Změnit roli</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const currentRole = user.roles[0] || "user";
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.position || "-"}</TableCell>
                      <TableCell>
                        <Badge className={roleColors[currentRole as keyof typeof roleColors]}>
                          {roleLabels[currentRole as keyof typeof roleLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={currentRole}
                          onValueChange={(value) => handleRoleChange(user.id, value)}
                          disabled={user.id === profile?.id}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Uživatel</SelectItem>
                            <SelectItem value="manager">Manažer</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <Card className="p-6 bg-muted/50">
        <h3 className="text-lg font-semibold mb-4">Popis rolí a oprávnění</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Badge className={roleColors.user}>Uživatel</Badge>
            <div className="text-sm">
              <p className="font-medium">Základní oprávnění</p>
              <p className="text-muted-foreground">
                Může vytvářet a upravovat vlastní školení, zobrazovat všechny záznamy
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge className={roleColors.manager}>Manažer</Badge>
            <div className="text-sm">
              <p className="font-medium">Rozšířená oprávnění</p>
              <p className="text-muted-foreground">
                Může spravovat typy školení, zaměstnance, oddělení a mazat školení
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge className={roleColors.admin}>Admin</Badge>
            <div className="text-sm">
              <p className="font-medium">Plná oprávnění</p>
              <p className="text-muted-foreground">
                Vše co manažer + správa uživatelských rolí a přístupů
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
