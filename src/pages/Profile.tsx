import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { User, Save, KeyRound, Mail, Shield, Search, Bell, Clock, Download, Users, TrendingUp, UserX, Palette } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Papa from "papaparse";
import { format, subMonths } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DisplaySettings } from "@/components/DisplaySettings";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  position?: string;
  roles: string[];
  created_at?: string;
  last_sign_in_at?: string;
}
const Profile = () => {
  const {
    toast
  } = useToast();
  const {
    profile,
    isAdmin,
    refreshProfile
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    open: boolean;
    email: string;
  }>({
    open: false,
    email: ""
  });

  // Změna hesla
  const [changePasswordDialog, setChangePasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Filtrování uživatelů
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Nastavení systému
  const loadSettings = () => {
    const saved = localStorage.getItem('systemSettings');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      emailNotificationsEnabled: false,
      defaultRemindDaysBefore: 30,
      defaultRepeatDaysAfter: 365,
      notificationCheckInterval: '0 8 * * *'
    };
  };
  const [settings, setSettings] = useState(loadSettings());

  // Form state pro vlastní profil
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [position, setPosition] = useState(profile?.position || "");
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name);
      setLastName(profile.last_name);
      setEmail(profile.email);
      setPosition(profile.position || "");
    }
  }, [profile]);
  useEffect(() => {
    if (isAdmin) {
      loadAllUsers();
    }
  }, [isAdmin]);
  const loadAllUsers = async () => {
    try {
      const {
        data: profiles,
        error: profilesError
      } = await supabase.from("profiles").select("*").order("created_at");
      if (profilesError) throw profilesError;
      const {
        data: roles,
        error: rolesError
      } = await supabase.from("user_roles").select("user_id, role");
      if (rolesError) throw rolesError;

      // Získat poslední přihlášení přes Edge Function (bezpečná alternativa k admin API)
      let authUsers: Array<{ id: string; last_sign_in_at?: string }> = [];
      try {
        const { data: funcData, error: funcError } = await supabase.functions.invoke("list-users");
        if (!funcError && funcData?.users) {
          authUsers = funcData.users;
        } else {
          console.warn("Failed to fetch auth users via Edge Function:", funcError);
        }
      } catch (funcErr) {
        console.warn("Edge Function call failed:", funcErr);
      }

      const usersWithRoles = profiles?.map(p => {
        const authUser = authUsers.find((au) => au.id === p.id);
        return {
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          position: p.position,
          created_at: p.created_at,
          last_sign_in_at: authUser?.last_sign_in_at,
          roles: roles?.filter(r => r.user_id === p.id).map(r => r.role) || []
        };
      }) || [];
      setAllUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání uživatelů",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const handleSaveOwnProfile = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const {
        error
      } = await supabase.from("profiles").update({
        first_name: firstName,
        last_name: lastName,
        email: email,
        position: position
      }).eq("id", profile.id);
      if (error) throw error;
      await refreshProfile();
      toast({
        title: "Profil aktualizován",
        description: "Váš profil byl úspěšně aktualizován."
      });
    } catch (error: any) {
      toast({
        title: "Chyba při aktualizaci profilu",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleSaveUserProfile = async () => {
    if (!editingUser) return;
    setLoading(true);
    try {
      const {
        error
      } = await supabase.from("profiles").update({
        first_name: editingUser.first_name,
        last_name: editingUser.last_name,
        email: editingUser.email,
        position: editingUser.position
      }).eq("id", editingUser.id);
      if (error) throw error;
      await loadAllUsers();
      setEditingUser(null);
      toast({
        title: "Profil aktualizován",
        description: "Profil uživatele byl úspěšně aktualizován."
      });
    } catch (error: any) {
      toast({
        title: "Chyba při aktualizaci profilu",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Hesla se neshodují",
        description: "Nové heslo a potvrzení hesla musí být stejné.",
        variant: "destructive"
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Heslo je příliš krátké",
        description: "Heslo musí mít alespoň 6 znaků.",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      const {
        error
      } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      toast({
        title: "Heslo změněno",
        description: "Vaše heslo bylo úspěšně změněno."
      });
      setChangePasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Chyba při změně hesla",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const {
        error
      } = await supabase.auth.resetPasswordForEmail(resetPasswordDialog.email, {
        redirectTo: `${window.location.origin}/auth`
      });
      if (error) throw error;
      toast({
        title: "Email pro reset hesla odeslán",
        description: `Na email ${resetPasswordDialog.email} byl odeslán odkaz pro reset hesla.`
      });
      setResetPasswordDialog({
        open: false,
        email: ""
      });
    } catch (error: any) {
      toast({
        title: "Chyba při odesílání emailu",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleRoleChange = async (userId: string, newRole: "admin" | "manager" | "user") => {
    setLoading(true);
    try {
      // Smazat stávající role
      const {
        error: deleteError
      } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (deleteError) throw deleteError;

      // Přidat novou roli
      const {
        error: insertError
      } = await supabase.from("user_roles").insert([{
        user_id: userId,
        role: newRole,
        created_by: profile?.id
      }]);
      if (insertError) throw insertError;
      await loadAllUsers();
      toast({
        title: "Role změněna",
        description: "Role uživatele byla úspěšně změněna."
      });
    } catch (error: any) {
      toast({
        title: "Chyba při změně role",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleSaveSettings = () => {
    localStorage.setItem('systemSettings', JSON.stringify(settings));
    toast({
      title: "Nastavení uloženo",
      description: "Vaše nastavení bylo úspěšně uloženo."
    });
  };
  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };
  const handleExportUsers = () => {
    const exportData = filteredUsers.map(user => ({
      "Jméno": user.first_name,
      "Příjmení": user.last_name,
      "Email": user.email,
      "Pozice": user.position || "",
      "Role": getRoleValue(user.roles),
      "Poslední přihlášení": user.last_sign_in_at ? format(new Date(user.last_sign_in_at), "dd.MM.yyyy HH:mm") : "",
      "Registrace": user.created_at ? format(new Date(user.created_at), "dd.MM.yyyy") : ""
    }));
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `uzivatele_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Export úspěšný",
      description: `Export ${filteredUsers.length} uživatelů byl dokončen.`
    });
  };
  const getUserStats = () => {
    const total = allUsers.length;
    const admins = allUsers.filter(u => u.roles.includes("admin")).length;
    const managers = allUsers.filter(u => u.roles.includes("manager")).length;
    const users = allUsers.filter(u => u.roles.includes("user")).length;
    return {
      total,
      admins,
      managers,
      users
    };
  };
  const getUserGrowthData = () => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const count = allUsers.filter(u => {
        if (!u.created_at) return false;
        const createdDate = new Date(u.created_at);
        return createdDate >= monthStart && createdDate <= monthEnd;
      }).length;
      months.push({
        month: format(date, "MMM yyyy"),
        users: count
      });
    }
    return months;
  };
  const handleBulkDeactivate = async () => {
    if (selectedUsers.length === 0) return;
    setLoading(true);
    try {
      // Změnit role na "user" a označit jako deaktivované
      for (const userId of selectedUsers) {
        await supabase.from("user_roles").delete().eq("user_id", userId);
      }
      await loadAllUsers();
      setSelectedUsers([]);
      toast({
        title: "Uživatelé deaktivováni",
        description: `${selectedUsers.length} uživatelů bylo deaktivováno.`
      });
    } catch (error: any) {
      toast({
        title: "Chyba při deaktivaci",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };
  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };
  const getRoleBadge = (roles: string[]) => {
    if (roles.includes("admin")) {
      return <Badge variant="destructive">Admin</Badge>;
    }
    if (roles.includes("manager")) {
      return <Badge variant="default">Manager</Badge>;
    }
    return <Badge variant="secondary">Uživatel</Badge>;
  };
  const getRoleValue = (roles: string[]) => {
    if (roles.includes("admin")) return "admin";
    if (roles.includes("manager")) return "manager";
    return "user";
  };
  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) || user.last_name.toLowerCase().includes(searchQuery.toLowerCase()) || user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });
  return <div className="space-y-6">
      <div className="flex items-center gap-3">
        <User className="w-8 h-8 text-primary" />
        <h2 className="text-3xl font-bold text-foreground">Profil a nastavení</h2>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Můj profil</TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Zobrazení
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Vlastní profil */}
          <Card>
            <CardHeader>
              <CardTitle>Můj profil</CardTitle>
              <CardDescription>Upravte své osobní údaje</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Jméno</Label>
                  <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Příjmení</Label>
                  <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Pozice</Label>
                <Input id="position" value={position} onChange={e => setPosition(e.target.value)} />
              </div>

              <Separator className="my-4" />
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Změna hesla</h3>
                <p className="text-sm text-muted-foreground">
                  Chcete-li změnit heslo, klikněte na tlačítko níže
                </p>
                <Button variant="outline" onClick={() => setChangePasswordDialog(true)}>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Změnit heslo
                </Button>
              </div>

              <div className="flex justify-end mt-6">
                <Button onClick={handleSaveOwnProfile} disabled={loading}>
                  <Save className="w-4 h-4 mr-2" />
                  Uložit změny
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Admin - statistiky a správa uživatelů */}
          {isAdmin && <>
              {/* Statistiky uživatelů */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <CardTitle>Statistiky uživatelů</CardTitle>
                  </div>
                  <CardDescription>
                    Přehled uživatelské základny
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-muted/50">
                      <Users className="w-8 h-8 text-primary mb-2" />
                      <div className="text-2xl font-bold">{getUserStats().total}</div>
                      <div className="text-sm text-muted-foreground">Celkem uživatelů</div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-red-500/10">
                      <Shield className="w-8 h-8 text-red-600 mb-2" />
                      <div className="text-2xl font-bold text-red-600">{getUserStats().admins}</div>
                      <div className="text-sm text-muted-foreground">Adminů</div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-blue-500/10">
                      <Shield className="w-8 h-8 text-blue-600 mb-2" />
                      <div className="text-2xl font-bold text-blue-600">{getUserStats().managers}</div>
                      <div className="text-sm text-muted-foreground">Manažerů</div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-green-500/10">
                      <User className="w-8 h-8 text-green-600 mb-2" />
                      <div className="text-2xl font-bold text-green-600">{getUserStats().users}</div>
                      <div className="text-sm text-muted-foreground">Uživatelů</div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-sm font-semibold mb-4">Růst uživatelské základny</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={getUserGrowthData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Správa uživatelů */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      <CardTitle>Správa uživatelů</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      {selectedUsers.length > 0 && <Button variant="destructive" size="sm" onClick={handleBulkDeactivate} disabled={loading}>
                          <UserX className="w-4 h-4 mr-2" />
                          Deaktivovat ({selectedUsers.length})
                        </Button>}
                      <Button variant="outline" size="sm" onClick={handleExportUsers} disabled={filteredUsers.length === 0}>
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Jako admin můžete upravovat profily ostatních uživatelů a resetovat jejich hesla
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 mb-4">
                    <div className="flex gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Hledat podle jména nebo emailu..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                      </div>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Filtrovat podle role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Všechny role</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="user">Uživatel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Checkbox id="select-all" checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0} onCheckedChange={toggleAllUsers} />
                      <Label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                        Vybrat všechny ({filteredUsers.length})
                      </Label>
                    </div>
                  </div>
                
                  <div className="space-y-4">
                    {filteredUsers.map(user => <Card key={user.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-3">
                            <Checkbox checked={selectedUsers.includes(user.id)} onCheckedChange={() => toggleUserSelection(user.id)} className="mt-1" />
                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <div className="space-y-3 flex-1">
                                  <div className="flex items-center gap-3">
                                    <h3 className="text-lg font-semibold">
                                      {user.first_name} {user.last_name}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                      {getRoleBadge(user.roles)}
                                      <Select value={getRoleValue(user.roles)} onValueChange={value => {
                                  if (value === "admin" || value === "manager" || value === "user") {
                                    handleRoleChange(user.id, value);
                                  }
                                }}>
                                        <SelectTrigger className="w-[140px] h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="admin">Admin</SelectItem>
                                          <SelectItem value="manager">Manager</SelectItem>
                                          <SelectItem value="user">Uživatel</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="space-y-1 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                      <Mail className="w-4 h-4" />
                                      <span>{user.email}</span>
                                    </div>
                                    {user.position && <div>
                                        <span className="font-medium">Pozice:</span> {user.position}
                                      </div>}
                                    {user.last_sign_in_at && <div>
                                        <span className="font-medium">Poslední přihlášení:</span>{" "}
                                        {format(new Date(user.last_sign_in_at), "dd.MM.yyyy HH:mm")}
                                      </div>}
                                    {user.created_at && <div>
                                        <span className="font-medium">Registrace:</span>{" "}
                                        {format(new Date(user.created_at), "dd.MM.yyyy")}
                                      </div>}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
                                    Upravit
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => setResetPasswordDialog({
                              open: true,
                              email: user.email
                            })}>
                                    <KeyRound className="w-4 h-4 mr-1" />
                                    Reset hesla
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>)}
                  </div>
                </CardContent>
              </Card>
            </>}
        </TabsContent>

        {/* Display Settings Tab */}
        <TabsContent value="display" className="space-y-6">
          <DisplaySettings />
        </TabsContent>

      </Tabs>

      {/* Dialog pro změnu hesla */}
      <Dialog open={changePasswordDialog} onOpenChange={setChangePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Změnit heslo</DialogTitle>
            <DialogDescription>
              Zadejte nové heslo. Heslo musí mít alespoň 6 znaků.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nové heslo</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Zadejte nové heslo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Potvrzení hesla</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Zadejte heslo znovu" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
            setChangePasswordDialog(false);
            setNewPassword("");
            setConfirmPassword("");
          }}>
              Zrušit
            </Button>
            <Button onClick={handleChangePassword} disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              Změnit heslo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pro úpravu uživatele */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit profil uživatele</DialogTitle>
            <DialogDescription>
              Změňte údaje uživatele {editingUser?.first_name} {editingUser?.last_name}
            </DialogDescription>
          </DialogHeader>
          {editingUser && <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jméno</Label>
                  <Input value={editingUser.first_name} onChange={e => setEditingUser({
                ...editingUser,
                first_name: e.target.value
              })} />
                </div>
                <div className="space-y-2">
                  <Label>Příjmení</Label>
                  <Input value={editingUser.last_name} onChange={e => setEditingUser({
                ...editingUser,
                last_name: e.target.value
              })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={editingUser.email} onChange={e => setEditingUser({
              ...editingUser,
              email: e.target.value
            })} />
              </div>
              <div className="space-y-2">
                <Label>Pozice</Label>
                <Input value={editingUser.position || ""} onChange={e => setEditingUser({
              ...editingUser,
              position: e.target.value
            })} />
              </div>
            </div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Zrušit
            </Button>
            <Button onClick={handleSaveUserProfile} disabled={loading}>
              Uložit změny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pro reset hesla */}
      <Dialog open={resetPasswordDialog.open} onOpenChange={open => setResetPasswordDialog({
      open,
      email: ""
    })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetovat heslo</DialogTitle>
            <DialogDescription>
              Opravdu chcete odeslat email pro reset hesla na adresu{" "}
              <strong>{resetPasswordDialog.email}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialog({
            open: false,
            email: ""
          })}>
              Zrušit
            </Button>
            <Button onClick={handleResetPassword} disabled={loading}>
              <KeyRound className="w-4 h-4 mr-2" />
              Odeslat email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
};
export default Profile;