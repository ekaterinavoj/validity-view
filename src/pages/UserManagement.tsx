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
import { Loader2, Shield, UserCog, Search, X, AlertTriangle, Download, FileSpreadsheet, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const { isAdmin, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    userId: string;
    userName: string;
    currentRole: string;
    newRole: string;
  } | null>(null);
  const [isLastAdminWarningOpen, setIsLastAdminWarningOpen] = useState(false);

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

  // Count admins in the system
  const adminCount = useMemo(() => {
    return users.filter(u => u.roles.includes("admin")).length;
  }, [users]);

  const handleRoleChangeRequest = (userId: string, currentRole: string, newRole: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    // CRITICAL: Prevent demoting the last admin (regardless of who is doing it)
    // This prevents the system from having zero admins
    if (currentRole === "admin" && newRole !== "admin" && adminCount <= 1) {
      setIsLastAdminWarningOpen(true);
      return;
    }

    // Show confirmation dialog
    setPendingRoleChange({
      userId,
      userName: `${user.first_name} ${user.last_name}`,
      currentRole,
      newRole,
    });
  };

  const confirmRoleChange = async () => {
    if (!pendingRoleChange) return;

    const { userId, newRole } = pendingRoleChange;
    const isChangingOwnRole = userId === profile?.id;

    try {
      // Remove all existing roles for this user
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Add the new role
      const { error } = await supabase.from("user_roles").insert([{
        user_id: userId,
        role: newRole as "admin" | "manager" | "user",
        created_by: profile?.id,
      }]);

      if (error) throw error;

      toast({
        title: "Role aktualizována",
        description: `Role uživatele ${pendingRoleChange.userName} byla změněna na ${roleLabels[newRole as keyof typeof roleLabels]}.`,
      });

      // Reload users list from DB
      await loadUsers();

      // If user changed their own role, refresh their session roles
      if (isChangingOwnRole) {
        await refreshProfile();
        
        // If user demoted themselves from admin, redirect to home
        if (pendingRoleChange.currentRole === "admin" && newRole !== "admin") {
          toast({
            title: "Role změněna",
            description: "Vaše administrátorská oprávnění byla odebrána. Budete přesměrováni.",
          });
          setTimeout(() => navigate("/"), 1500);
        }
      }
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se aktualizovat roli. Zkuste to prosím znovu.",
        variant: "destructive",
      });
    } finally {
      setPendingRoleChange(null);
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

  // Export functions
  const exportToExcel = () => {
    try {
      const dataToExport = filteredUsers.map(user => ({
        "Jméno": `${user.first_name} ${user.last_name}`,
        "Email": user.email,
        "Pozice": user.position || "-",
        "Role": roleLabels[user.roles[0] as keyof typeof roleLabels] || "Uživatel",
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Uživatelé");
      
      const timestamp = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `uzivatele_${timestamp}.xlsx`);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${filteredUsers.length} uživatelů do Excel.`,
      });
    } catch (error) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text("Správa uživatelů", 14, 15);
      doc.setFontSize(10);
      doc.text(`Vygenerováno: ${new Date().toLocaleDateString("cs-CZ")}`, 14, 22);

      const tableData = filteredUsers.map(user => [
        `${user.first_name} ${user.last_name}`,
        user.email,
        user.position || "-",
        roleLabels[user.roles[0] as keyof typeof roleLabels] || "Uživatel",
      ]);

      autoTable(doc, {
        head: [["Jméno", "Email", "Pozice", "Role"]],
        body: tableData,
        startY: 28,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      const timestamp = new Date().toISOString().split("T")[0];
      doc.save(`uzivatele_${timestamp}.pdf`);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${filteredUsers.length} uživatelů do PDF.`,
      });
    } catch (error) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Admin count warning */}
      {adminCount <= 1 && (
        <Card className="p-4 border-yellow-500 bg-yellow-500/10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-300">
                V systému je pouze jeden administrátor
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Před změnou své role povyšte jiného uživatele na administrátora.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b">
            <UserCog className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Uživatelé systému</h3>
            <Badge variant="secondary">{users.length} uživatelů</Badge>
            <Badge variant="outline" className="text-red-600 border-red-300">
              {adminCount} admin{adminCount !== 1 ? "ů" : ""}
            </Badge>
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
                    const isCurrentUser = user.id === profile?.id;
                    const isLastAdmin = currentRole === "admin" && adminCount <= 1;
                    
                    return (
                      <TableRow key={user.id} className={isCurrentUser ? "bg-primary/5" : ""}>
                        <TableCell className="font-medium">
                          {user.first_name} {user.last_name}
                          {isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">Vy</Badge>
                          )}
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
                            onValueChange={(value) => handleRoleChangeRequest(user.id, currentRole, value)}
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
                Vše co manažer + správa uživatelských rolí, přístup k logům a nastavení systému
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Role change confirmation dialog */}
      <AlertDialog open={!!pendingRoleChange} onOpenChange={() => setPendingRoleChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potvrdit změnu role</AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chcete změnit roli uživatele <strong>{pendingRoleChange?.userName}</strong> z{" "}
              <Badge className={roleColors[pendingRoleChange?.currentRole as keyof typeof roleColors]}>
                {roleLabels[pendingRoleChange?.currentRole as keyof typeof roleLabels]}
              </Badge>{" "}
              na{" "}
              <Badge className={roleColors[pendingRoleChange?.newRole as keyof typeof roleColors]}>
                {roleLabels[pendingRoleChange?.newRole as keyof typeof roleLabels]}
              </Badge>
              ?
              {pendingRoleChange?.userId === profile?.id && (
                <p className="mt-2 text-yellow-600 font-medium">
                  ⚠️ Měníte svoji vlastní roli. Tato změna se projeví okamžitě.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              Potvrdit změnu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Last admin warning dialog */}
      <AlertDialog open={isLastAdminWarningOpen} onOpenChange={setIsLastAdminWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="w-5 h-5" />
              Nelze změnit roli
            </AlertDialogTitle>
            <AlertDialogDescription>
              Jste jediný administrátor v systému. Před změnou své role musíte nejprve
              povýšit jiného uživatele na administrátora, aby systém zůstal spravovatelný.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsLastAdminWarningOpen(false)}>
              Rozumím
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
