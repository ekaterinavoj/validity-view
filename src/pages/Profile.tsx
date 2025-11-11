import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { User, Save, KeyRound, Mail, Shield } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  position?: string;
  roles: string[];
}

const Profile = () => {
  const { toast } = useToast();
  const { profile, isAdmin, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ open: boolean; email: string }>({
    open: false,
    email: "",
  });

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
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at");

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const usersWithRoles = profiles?.map((p) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        position: p.position,
        roles: roles?.filter((r) => r.user_id === p.id).map((r) => r.role) || [],
      })) || [];

      setAllUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání uživatelů",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveOwnProfile = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          email: email,
          position: position,
        })
        .eq("id", profile.id);

      if (error) throw error;

      await refreshProfile();

      toast({
        title: "Profil aktualizován",
        description: "Váš profil byl úspěšně aktualizován.",
      });
    } catch (error: any) {
      toast({
        title: "Chyba při aktualizaci profilu",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUserProfile = async () => {
    if (!editingUser) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: editingUser.first_name,
          last_name: editingUser.last_name,
          email: editingUser.email,
          position: editingUser.position,
        })
        .eq("id", editingUser.id);

      if (error) throw error;

      await loadAllUsers();
      setEditingUser(null);

      toast({
        title: "Profil aktualizován",
        description: "Profil uživatele byl úspěšně aktualizován.",
      });
    } catch (error: any) {
      toast({
        title: "Chyba při aktualizaci profilu",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetPasswordDialog.email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      toast({
        title: "Email pro reset hesla odeslán",
        description: `Na email ${resetPasswordDialog.email} byl odeslán odkaz pro reset hesla.`,
      });
      
      setResetPasswordDialog({ open: false, email: "" });
    } catch (error: any) {
      toast({
        title: "Chyba při odesílání emailu",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <User className="w-8 h-8 text-primary" />
        <h2 className="text-3xl font-bold text-foreground">Profil a nastavení</h2>
      </div>

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
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Příjmení</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Pozice</Label>
            <Input
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveOwnProfile} disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              Uložit změny
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Admin - správa uživatelů */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>Správa uživatelů</CardTitle>
            </div>
            <CardDescription>
              Jako admin můžete upravovat profily ostatních uživatelů a resetovat jejich hesla
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allUsers.map((user) => (
                <Card key={user.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">
                            {user.first_name} {user.last_name}
                          </h3>
                          {getRoleBadge(user.roles)}
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span>{user.email}</span>
                          </div>
                          {user.position && (
                            <div>
                              <span className="font-medium">Pozice:</span> {user.position}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUser(user)}
                        >
                          Upravit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResetPasswordDialog({ open: true, email: user.email })}
                        >
                          <KeyRound className="w-4 h-4 mr-1" />
                          Reset hesla
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog pro úpravu uživatele */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upravit profil uživatele</DialogTitle>
            <DialogDescription>
              Změňte údaje uživatele {editingUser?.first_name} {editingUser?.last_name}
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jméno</Label>
                  <Input
                    value={editingUser.first_name}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Příjmení</Label>
                  <Input
                    value={editingUser.last_name}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, last_name: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Pozice</Label>
                <Input
                  value={editingUser.position || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, position: e.target.value })
                  }
                />
              </div>
            </div>
          )}
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
      <Dialog
        open={resetPasswordDialog.open}
        onOpenChange={(open) => setResetPasswordDialog({ open, email: "" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetovat heslo</DialogTitle>
            <DialogDescription>
              Opravdu chcete odeslat email pro reset hesla na adresu{" "}
              <strong>{resetPasswordDialog.email}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetPasswordDialog({ open: false, email: "" })}
            >
              Zrušit
            </Button>
            <Button onClick={handleResetPassword} disabled={loading}>
              <KeyRound className="w-4 h-4 mr-2" />
              Odeslat email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
