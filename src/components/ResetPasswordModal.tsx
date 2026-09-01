import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, RefreshCw } from "lucide-react";
import { validatePassword, PASSWORD_POLICY_HINT } from "@/lib/passwordPolicy";

interface ResetPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  userName: string;
  onSuccess: () => void;
}

function generatePassword(length = 12): string {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const symbols = "!@#$%";
  const all = lower + upper + digits + symbols;

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  const pick = (set: string, i: number) => set.charAt(array[i] % set.length);

  // Guarantee at least one of each required class up front (the policy check
  // isn't just theoretical — with a fully random draw there's a small but
  // real chance of missing a class entirely on a 12-char password), then fill
  // the rest randomly and shuffle so the required characters aren't always
  // in the same first three positions.
  const chars = [pick(lower, 0), pick(upper, 1), pick(digits, 2)];
  for (let i = 3; i < length; i++) chars.push(pick(all, i));

  const shuffleOrder = new Uint32Array(length);
  crypto.getRandomValues(shuffleOrder);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleOrder[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export function ResetPasswordModal({
  open,
  onOpenChange,
  userId,
  userEmail,
  userName,
  onSuccess,
}: ResetPasswordModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState(generatePassword());
  const [showPassword, setShowPassword] = useState(false);

  // Reset form on open/close
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setNewPassword(generatePassword());
      setShowPassword(false);
    }
    onOpenChange(isOpen);
  };

  const handleReset = async () => {
    const trimmedPassword = newPassword.trim();

    const passwordErrors = validatePassword(trimmedPassword);
    if (passwordErrors.length > 0) {
      toast({
        title: "Heslo nesplňuje požadavky",
        description: passwordErrors.join(" "),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: {
          userId,
          newPassword: trimmedPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Heslo resetováno",
        description: `Nové heslo bylo nastaveno pro ${userEmail}. Uživatel bude vyzván ke změně hesla při příštím přihlášení.`,
      });

      onSuccess();
      handleOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Chyba při resetování hesla",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetovat heslo</DialogTitle>
          <DialogDescription>
            Nastavte nové heslo pro uživatele <strong>{userName}</strong> ({userEmail}).
            Uživatel bude po přihlášení vyzván ke změně hesla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nové heslo</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setNewPassword(generatePassword())}
                title="Vygenerovat nové heslo"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {PASSWORD_POLICY_HINT} Heslo předejte uživateli bezpečným způsobem.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Zrušit
          </Button>
          <Button onClick={handleReset} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetuji...
              </>
            ) : (
              "Resetovat heslo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
