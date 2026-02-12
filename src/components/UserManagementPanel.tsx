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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Search, RefreshCw, FileSpreadsheet, FileDown, AlertTriangle, Shield, UserPlus, Info, MoreHorizontal, Key, Mail, UserX, UserCheck, Settings2, Download, Trash2 } from "lucide-react";
import { ProfileEmployeeLink } from "@/components/ProfileEmployeeLink";
import { AddUserModal } from "@/components/AddUserModal";
import { ResetPasswordModal } from "@/components/ResetPasswordModal";
import { ChangeEmailModal } from "@/components/ChangeEmailModal";
import { ModuleAccessManager } from "@/components/ModuleAccessManager";
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  position?: string;
  roles: string[];
  employee_id?: string | null;
  approval_status?: string;
  updated_at?: string; // From auth - indicates last password change
  created_at?: string; // From auth
}

const roleLabels: Record<string, string> = {
  admin: "Administrátor",
  manager: "Manažer",
  user: "Uživatel",
  viewer: "Prohlížeč",
};

const roleColors: Record<string, string> = {
  admin: "bg-role-admin/20 text-role-admin-foreground dark:text-role-admin",
  manager: "bg-role-manager/20 text-role-manager-foreground dark:text-role-manager",
  user: "bg-role-user/20 text-role-user-foreground dark:text-role-user",
  viewer: "bg-role-viewer/20 text-role-viewer-foreground dark:text-role-viewer",
};

export function UserManagementPanel() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  
  // Modal states
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [resetPasswordModal, setResetPasswordModal] = useState<{
    open: boolean;
    userId: string;
    userEmail: string;
    userName: string;
  }>({ open: false, userId: "", userEmail: "", userName: "" });
  const [changeEmailModal, setChangeEmailModal] = useState<{
    open: boolean;
    userId: string;
    currentEmail: string;
    userName: string;
  }>({ open: false, userId: "", currentEmail: "", userName: "" });
  const [moduleAccessModal, setModuleAccessModal] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    isAdmin: boolean;
  }>({ open: false, userId: "", userName: "", isAdmin: false });
  
  // Role change states
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    userId: string;
    userName: string;
    currentRole: string;
    newRole: string;
  } | null>(null);
  const [isLastAdminWarningOpen, setIsLastAdminWarningOpen] = useState(false);
  
  // Deactivation states
  const [pendingDeactivation, setPendingDeactivation] = useState<{
    userId: string;
    userName: string;
    userEmail: string;
    action: "deactivate" | "reactivate";
  } | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Permanent deletion states
  const [pendingDeletion, setPendingDeletion] = useState<{
    userId: string;
    userName: string;
    userEmail: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

      // Load auth user data (updated_at for password changes) - only for admins
      let authUsersMap: Record<string, { updated_at?: string; created_at?: string }> = {};
      try {
        const { data: authData, error: authError } = await supabase.functions.invoke("list-users");
        if (!authError && authData?.users) {
          authUsersMap = authData.users.reduce((acc: Record<string, any>, u: any) => {
            acc[u.id] = { updated_at: u.updated_at, created_at: u.created_at };
            return acc;
          }, {});
        }
      } catch (e) {
        // Non-critical - auth data is optional
        console.warn("Could not load auth user data:", e);
      }

      // Build role lookup map for O(n) join
      const rolesMap = new Map<string, string[]>();
      for (const r of rolesData || []) {
        const existing = rolesMap.get(r.user_id);
        if (existing) {
          existing.push(r.role);
        } else {
          rolesMap.set(r.user_id, [r.role]);
        }
      }

      const usersWithRoles: UserProfile[] = (profilesData || []).map((p) => ({
        ...p,
        roles: rolesMap.get(p.id) || [],
        approval_status: p.approval_status,
        updated_at: authUsersMap[p.id]?.updated_at,
        created_at: authUsersMap[p.id]?.created_at,
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

    // Check if trying to demote the last admin
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
        role: newRole as "admin" | "manager" | "user" | "viewer",
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

  const handleDeactivation = async () => {
    if (!pendingDeactivation) return;
    
    setIsDeactivating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-deactivate-user", {
        body: {
          userId: pendingDeactivation.userId,
          action: pendingDeactivation.action,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({
        title: pendingDeactivation.action === "deactivate" ? "Uživatel deaktivován" : "Uživatel reaktivován",
        description: pendingDeactivation.action === "deactivate"
          ? `Účet ${pendingDeactivation.userEmail} byl deaktivován a uživatel se nemůže přihlásit.`
          : `Účet ${pendingDeactivation.userEmail} byl reaktivován a uživatel se může přihlásit.`,
      });
      
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se změnit stav uživatele.",
        variant: "destructive",
      });
    } finally {
      setIsDeactivating(false);
      setPendingDeactivation(null);
    }
  };

  const handlePermanentDeletion = async () => {
    if (!pendingDeletion) return;
    
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId: pendingDeletion.userId },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({
        title: "Uživatel smazán",
        description: `Účet ${pendingDeletion.userEmail} byl trvale odstraněn včetně všech souvisejících dat.`,
      });
      
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se smazat uživatele.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setPendingDeletion(null);
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

  const exportToCSV = () => {
    const data = filteredUsers.map((u) => ({
      "Jméno": `${u.first_name} ${u.last_name}`,
      "Email": u.email,
      "Pozice": u.position || "",
      "Role": u.roles.map(r => roleLabels[r] || r).join(", "),
    }));

    const csv = Papa.unparse(data, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `uzivatele_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

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
        <Card className="border-warning bg-warning/10">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium text-foreground">
                  Pouze jeden administrátor
                </p>
                <p className="text-sm text-muted-foreground">
                  V systému je pouze jeden administrátor. Doporučujeme přidat dalšího administrátora 
                  pro případ nedostupnosti. Role jediného admina nelze změnit.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info about admin provisioning */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">
                Jak přidat nového uživatele?
              </p>
              <p className="text-sm text-muted-foreground">
                Uživatele přidává administrátor v této sekci pomocí tlačítka "Přidat uživatele". 
                Zde mu nastaví roli, moduly a propojení na zaměstnance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info about employee linking */}
      <Card className="border-warning/20 bg-warning/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-warning mt-0.5" />
            <div>
              <p className="font-medium text-foreground">
                Propojení se zaměstnancem je klíčové!
              </p>
              <p className="text-sm text-muted-foreground">
                Non-admin uživatelé vidí pouze záznamy přiřazené k jejich zaměstnaneckému profilu. 
                Bez propojení neuvidí žádná školení ani technické lhůty.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Správa uživatelů a rolí
              </CardTitle>
              <CardDescription>
                Správa uživatelských účtů a přidělování rolí v systému
              </CardDescription>
            </div>
            <Button onClick={() => setAddUserModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Přidat uživatele
            </Button>
          </div>
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
                <SelectItem value="viewer">Prohlížeč</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadUsers}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Obnovit
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              CSV
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
                  <TableHead>Stav</TableHead>
                  <TableHead>Poslední změna hesla</TableHead>
                  <TableHead>Propojení se zaměstnancem</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Změnit roli</TableHead>
                  <TableHead className="w-12">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Žádní uživatelé nenalezeni
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const currentRole = user.roles[0] || "user";
                    const isCurrentUser = user.id === profile?.id;
                    const isAdmin = currentRole === "admin";
                    const userName = `${user.first_name} ${user.last_name}`.trim() || user.email;
                    const isDeactivated = user.approval_status === "deactivated";
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.first_name} {user.last_name}
                          {isCurrentUser && (
                            <Badge variant="outline" className="ml-2 text-xs">Vy</Badge>
                          )}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {isDeactivated ? (
                            <Badge variant="destructive" className="text-xs">
                              <UserX className="w-3 h-3 mr-1" />
                              Deaktivován
                            </Badge>
                          ) : (
                            <Badge className="text-xs bg-primary text-primary-foreground">
                              <UserCheck className="w-3 h-3 mr-1" />
                              Aktivní
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.updated_at ? (
                            <span title={new Date(user.updated_at).toLocaleString("cs-CZ")}>
                              {new Date(user.updated_at).toLocaleDateString("cs-CZ")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <Badge variant="secondary" className="text-xs">
                              Admin – vidí vše
                            </Badge>
                          ) : (
                            <ProfileEmployeeLink
                              profileId={user.id}
                              currentEmployeeId={user.employee_id || null}
                              onLinkChanged={loadUsers}
                            />
                          )}
                        </TableCell>
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
                              <SelectItem value="viewer">Prohlížeč</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setResetPasswordModal({
                                  open: true,
                                  userId: user.id,
                                  userEmail: user.email,
                                  userName,
                                })}
                              >
                                <Key className="h-4 w-4 mr-2" />
                                Reset hesla
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setChangeEmailModal({
                                  open: true,
                                  userId: user.id,
                                  currentEmail: user.email,
                                  userName,
                                })}
                              >
                                <Mail className="h-4 w-4 mr-2" />
                                Změnit email
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setModuleAccessModal({
                                  open: true,
                                  userId: user.id,
                                  userName,
                                  isAdmin,
                                })}
                              >
                                <Settings2 className="h-4 w-4 mr-2" />
                                Moduly
                              </DropdownMenuItem>
                              {!isCurrentUser && (
                                <DropdownMenuItem
                                  onClick={() => setPendingDeactivation({
                                    userId: user.id,
                                    userName,
                                    userEmail: user.email,
                                    action: isDeactivated ? "reactivate" : "deactivate",
                                  })}
                                  className={isDeactivated ? "" : "text-destructive focus:text-destructive"}
                                >
                                  {isDeactivated ? (
                                    <>
                                      <UserCheck className="h-4 w-4 mr-2" />
                                      Reaktivovat účet
                                    </>
                                  ) : (
                                    <>
                                      <UserX className="h-4 w-4 mr-2" />
                                      Deaktivovat účet
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                              {!isCurrentUser && isDeactivated && (
                                <DropdownMenuItem
                                  onClick={() => setPendingDeletion({
                                    userId: user.id,
                                    userName,
                                    userEmail: user.email,
                                  })}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Smazat účet
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Add User Modal */}
      <AddUserModal
        open={addUserModalOpen}
        onOpenChange={setAddUserModalOpen}
        onUserCreated={loadUsers}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        open={resetPasswordModal.open}
        onOpenChange={(open) => setResetPasswordModal(prev => ({ ...prev, open }))}
        userId={resetPasswordModal.userId}
        userEmail={resetPasswordModal.userEmail}
        userName={resetPasswordModal.userName}
        onSuccess={loadUsers}
      />

      {/* Change Email Modal */}
      <ChangeEmailModal
        open={changeEmailModal.open}
        onOpenChange={(open) => setChangeEmailModal(prev => ({ ...prev, open }))}
        userId={changeEmailModal.userId}
        currentEmail={changeEmailModal.currentEmail}
        userName={changeEmailModal.userName}
        onSuccess={loadUsers}
      />

      {/* Module Access Manager Modal */}
      <ModuleAccessManager
        open={moduleAccessModal.open}
        onOpenChange={(open) => setModuleAccessModal(prev => ({ ...prev, open }))}
        userId={moduleAccessModal.userId}
        userName={moduleAccessModal.userName}
        isAdmin={moduleAccessModal.isAdmin}
        onSuccess={loadUsers}
      />

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
              administrátora (povyšte jiného uživatele na admin), než změníte roli tohoto uživatele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsLastAdminWarningOpen(false)}>
              Rozumím
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivation Confirmation Dialog */}
      <AlertDialog open={!!pendingDeactivation} onOpenChange={() => setPendingDeactivation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {pendingDeactivation?.action === "deactivate" ? (
                <>
                  <UserX className="w-5 h-5 text-destructive" />
                  Deaktivovat uživatele
                </>
              ) : (
                <>
                  <UserCheck className="w-5 h-5 text-primary" />
                  Reaktivovat uživatele
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeactivation?.action === "deactivate" ? (
                <>
                  Opravdu chcete deaktivovat účet uživatele{" "}
                  <strong>{pendingDeactivation?.userName}</strong> ({pendingDeactivation?.userEmail})?
                  <br /><br />
                  Deaktivovaný uživatel se nebude moci přihlásit do systému.
                </>
              ) : (
                <>
                  Opravdu chcete reaktivovat účet uživatele{" "}
                  <strong>{pendingDeactivation?.userName}</strong> ({pendingDeactivation?.userEmail})?
                  <br /><br />
                  Uživatel se bude moci opět přihlásit do systému.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating}>Zrušit</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeactivation}
              disabled={isDeactivating}
              className={pendingDeactivation?.action === "deactivate" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Zpracování...
                </>
              ) : pendingDeactivation?.action === "deactivate" ? (
                "Deaktivovat"
              ) : (
                "Reaktivovat"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Deletion Confirmation Dialog */}
      <AlertDialog open={!!pendingDeletion} onOpenChange={() => setPendingDeletion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Trvale smazat uživatele
            </AlertDialogTitle>
            <AlertDialogDescription>
              Opravdu chcete <strong>trvale smazat</strong> účet uživatele{" "}
              <strong>{pendingDeletion?.userName}</strong> ({pendingDeletion?.userEmail})?
              <br /><br />
              <span className="font-medium text-destructive">
                Tato akce je nevratná! Budou odstraněny:
              </span>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Uživatelský účet a profil</li>
                <li>Přiřazené role a moduly</li>
                <li>Členství ve skupinách odpovědností</li>
                <li>Přiřazení k technickým lhůtám a zařízením</li>
                <li>Notifikace</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Zrušit</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePermanentDeletion}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mazání...
                </>
              ) : (
                "Trvale smazat"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
