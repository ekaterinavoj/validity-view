import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { User, Save, KeyRound, Palette, ShieldCheck, LogOut } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DisplaySettings } from "@/components/DisplaySettings";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { evaluatePassword } from "@/lib/passwordStrength";
import { usePasswordPolicy } from "@/hooks/usePasswordPolicy";

const Profile = () => {
  const { toast } = useToast();
  const { profile, refreshProfile } = useAuth();
  const { policy } = usePasswordPolicy();
  const [loading, setLoading] = useState(false);

  // Změna hesla
  const [changePasswordDialog, setChangePasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  const passwordEval = evaluatePassword(newPassword, policy);
  const canChangePassword =
    passwordEval.meetsMinimum && newPassword === confirmPassword && confirmPassword.length > 0;

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Hesla se neshodují",
        description: "Nové heslo a potvrzení hesla musí být stejné.",
        variant: "destructive",
      });
      return;
    }
    if (!passwordEval.meetsMinimum) {
      toast({
        title: "Heslo nesplňuje požadavky",
        description: passwordEval.firstError || `Heslo musí mít alespoň ${policy.min_length} znaků a splňovat aktuální pravidla.`,
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        if (/pwned|breach|leaked|weak/i.test(error.message ?? "")) {
          throw new Error(
            "Toto heslo bylo nalezeno v databázi uniklých hesel. Zvolte prosím jiné, silnější heslo."
          );
        }
        throw error;
      }
      // Reset password review flag (validated client-side + HIBP server-side)
      try {
        await supabase.rpc("mark_password_reviewed" as any);
        await refreshProfile();
      } catch (e) {
        console.warn("mark_password_reviewed failed (non-critical):", e);
      }
      toast({
        title: "Heslo změněno",
        description: "Vaše heslo bylo úspěšně změněno.",
      });
      setChangePasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: "Chyba při změně hesla",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutOthers = async () => {
    const ok = window.confirm(
      "Opravdu chcete odhlásit všechna ostatní přihlášení? Tato akce zachová pouze vaše aktuální přihlášení v tomto prohlížeči."
    );
    if (!ok) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast({
        title: "Ostatní zařízení odhlášena",
        description: "Všechna ostatní přihlášení k vašemu účtu byla ukončena.",
      });
    } catch (error: any) {
      toast({
        title: "Chyba při odhlášení",
        description: error?.message ?? "Nepodařilo se odhlásit ostatní zařízení.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 justify-between flex-wrap">
        <div className="flex items-center gap-3">
          <User className="w-8 h-8 text-primary" />
          <h2 className="text-3xl font-bold text-foreground">Profil a nastavení</h2>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/my-permissions">Moje oprávnění</a>
        </Button>
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
          <Card>
            <CardHeader>
              <CardTitle>Můj profil</CardTitle>
              <CardDescription>Upravte své osobní údaje</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Jméno</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Příjmení</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Pozice</Label>
                <Input id="position" value={position} onChange={(e) => setPosition(e.target.value)} />
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Změna hesla</h3>
                <p className="text-sm text-muted-foreground">
                  Heslo musí mít minimálně {policy.min_length} znaků a splňovat aktuální pravidla nastavená administrátorem.
                </p>
                <Button variant="outline" onClick={() => setChangePasswordDialog(true)}>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Změnit heslo
                </Button>
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Aktivní přihlášení</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Z bezpečnostních důvodů můžete jedním kliknutím odhlásit všechna ostatní zařízení a prohlížeče,
                  ve kterých jste aktuálně přihlášeni. Vaše současné přihlášení v tomto prohlížeči zůstane aktivní.
                </p>
                <Button
                  variant="outline"
                  onClick={handleSignOutOthers}
                  disabled={loading}
                  className="text-destructive hover:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Odhlásit všechna ostatní zařízení
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
        </TabsContent>

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
              Heslo musí mít alespoň {policy.min_length} znaků a splňovat aktuální pravidla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nové heslo</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Zadejte nové heslo"
                autoComplete="new-password"
              />
              <PasswordStrengthMeter password={newPassword} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Potvrzení hesla</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Zadejte heslo znovu"
                autoComplete="new-password"
              />
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <p className="text-xs text-destructive">Hesla se neshodují.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setChangePasswordDialog(false);
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Zrušit
            </Button>
            <Button onClick={handleChangePassword} disabled={loading || !canChangePassword}>
              <Save className="w-4 h-4 mr-2" />
              Změnit heslo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
