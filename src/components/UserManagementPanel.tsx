import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Loader2, Search, RefreshCw, FileSpreadsheet, FileDown, AlertTriangle, Shield } from "lucide-react";
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

const roleLabels: Record<string, string> = {
  admin: "Administrátor",
  manager: "Manažer",
  user: "Uživatel",
};

const roleColors: Record<string, string> = {
  admin: "bg-red-500",
  manager: "bg-blue-500",
  user: "bg-green-500",
};

export function UserManagementPanel() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
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
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("last_name");

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const usersWithRoles: UserProfile[] = (profilesData || []).map((p) => ({
        ...p,
        roles: rolesData?.filter((r) => r.user_id === p.id).map((r) => r.role) || [],
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst uživatele.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const adminCount = useMemo(() => {
    return users.filter(u => u.roles.includes("admin")).length;
  }, [users]);

  const handleRoleChangeRequest = (userId: string, currentRole: string, newRole: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (currentRole === "admin" && newRole !== "admin" && adminCount <= 1) {
      setIsLastAdminWarningOpen(true);
      return;
    }

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
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      const { error } = await supabase.from("user_roles").insert([{
        user_id: userId,
        role: newRole as "admin" | "manager" | "user",
        created_by: profile?.id,
      }]);

      if (error) throw error;

      toast({
        title: "Role aktualizována",
        description: `Role uživatele ${pendingRoleChange.userName} byla změněna na ${roleLabels[newRole]}.`,
      });

      await loadUsers();

      if (isChangingOwnRole) {
        await refreshProfile();
      }
    } catch (error: any) {
      toast({
        title: "Chyba při změně role",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPendingRoleChange(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        searchQuery === "" ||
        user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole =
        roleFilter === "all" || user.roles.includes(roleFilter);

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const exportToExcel = () => {
    const data = filteredUsers.map((u) => ({
      "Jméno": `${u.first_name} ${u.last_name}`,
      "Email": u.email,
      "Pozice": u.position || "",
      "Role": u.roles.map(r => roleLabels[r] || r).join(", "),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Uživatelé");
    XLSX.writeFile(wb, `uzivatele_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({ title: "Export úspěšný", description: `Exportováno ${data.length} uživatelů.` });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Seznam uživatelů", 14, 15);
    doc.setFontSize(10);
    doc.text(`Vygenerováno: ${new Date().toLocaleDateString("cs-CZ")}`, 14, 22);

    autoTable(doc, {
      head: [["Jméno", "Email", "Pozice", "Role"]],
      body: filteredUsers.map((u) => [
        `${u.first_name} ${u.last_name}`,
        u.email,
        u.position || "",
        u.roles.map(r => roleLabels[r] || r).join(", "),
      ]),
      startY: 28,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`uzivatele_${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "Export úspěšný", description: `Exportováno ${filteredUsers.length} uživatelů.` });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {adminCount <= 1 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Pouze jeden administrátor
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  V systému je pouze jeden administrátor. Přidejte dalšího před změnou role.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Správa uživatelů a rolí
          </CardTitle>
          <CardDescription>
            Správa uživatelských účtů a přidělování rolí v systému
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hledat uživatele..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny role</SelectItem>
                <SelectItem value="admin">Administrátor</SelectItem>
                <SelectItem value="manager">Manažer</SelectItem>
                <SelectItem value="user">Uživatel</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadUsers}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Obnovit
            </Button>
            <Button variant="outline" size="sm" onClick={exportToExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <FileDown className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jméno</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Pozice</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Změnit roli</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Žádní uživatelé nenalezeni
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const currentRole = user.roles[0] || "user";
                    const isCurrentUser = user.id === profile?.id;
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.first_name} {user.last_name}
                          {isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">Vy</Badge>
                          )}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.position || "-"}</TableCell>
                        <TableCell>
                          <Badge className={roleColors[currentRole]}>
                            {roleLabels[currentRole] || currentRole}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={currentRole}
                            onValueChange={(newRole) =>
                              handleRoleChangeRequest(user.id, currentRole, newRole)
                            }
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administrátor</SelectItem>
                              <SelectItem value="manager">Manažer</SelectItem>
                              <SelectItem value="user">Uživatel</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog open={!!pendingRoleChange} onOpenChange={() => setPendingRoleChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potvrdit změnu role</AlertDialogTitle>
            <AlertDialogDescription>
              Chcete změnit roli uživatele{" "}
              <strong>{pendingRoleChange?.userName}</strong> z{" "}
              <strong>{roleLabels[pendingRoleChange?.currentRole || ""]}</strong> na{" "}
              <strong>{roleLabels[pendingRoleChange?.newRole || ""]}</strong>?
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

      {/* Last Admin Warning Dialog */}
      <AlertDialog open={isLastAdminWarningOpen} onOpenChange={setIsLastAdminWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Nelze změnit roli
            </AlertDialogTitle>
            <AlertDialogDescription>
              Toto je poslední administrátor v systému. Nejprve přidejte dalšího
              administrátora, než změníte roli tohoto uživatele.
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