import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, UserCog, Search, X } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

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

  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Filter by search query (name or email)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((user) => {
        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
        const email = user.email.toLowerCase();
        return fullName.includes(query) || email.includes(query);
      });
    }

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => {
        const currentRole = user.roles[0] || "user";
        return currentRole === roleFilter;
      });
    }

    return filtered;
  }, [users, searchQuery, roleFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
  };

  const hasActiveFilters = searchQuery !== "" || roleFilter !== "all";

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

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hledat podle jména nebo emailu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrovat podle role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny role</SelectItem>
                <SelectItem value="user">Uživatel</SelectItem>
                <SelectItem value="manager">Manažer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="icon"
                onClick={clearFilters}
                title="Vymazat filtry"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Results count */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Zobrazeno <strong>{filteredUsers.length}</strong> z <strong>{users.length}</strong> uživatelů
              </span>
            </div>
          )}

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
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {hasActiveFilters 
                        ? "Žádní uživatelé nevyhovují zadaným filtrům."
                        : "Žádní uživatelé nenalezeni."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
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
                  })
                )}
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
