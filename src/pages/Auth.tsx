import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, ShieldAlert } from "lucide-react";
import { z } from "zod";
import companyLogo from "@/assets/company-logo.png";
import { consumeIdleLogoutFlag } from "@/hooks/useSessionTimeout";
import { supabase } from "@/integrations/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Zadejte platný email"),
});

function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { resetPasswordForEmail } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      // Reset for next time the dialog is opened
      setEmail("");
      setError("");
      setSent(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0]?.message || "Neplatný email");
      return;
    }

    setIsLoading(true);
    const { error: resetError } = await resetPasswordForEmail(email.trim());
    setIsLoading(false);

    if (resetError) {
      toast({
        title: "Chyba",
        description: "Odkaz pro obnovení hesla se nepodařilo odeslat. Zkuste to prosím později.",
        variant: "destructive",
      });
      return;
    }

    // Always show the same success message regardless of whether the email
    // actually matches an account — do not reveal which addresses exist.
    setSent(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zapomenuté heslo</DialogTitle>
          <DialogDescription>
            Zadejte email svého účtu. Pokud pod ním existuje účet, přijde na něj odkaz pro nastavení nového hesla.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pokud účet s tímto emailem existuje, byl na něj právě odeslán odkaz pro obnovení hesla.
              Zkontrolujte doručenou poštu (i spam).
            </p>
            <Button className="w-full" onClick={() => handleClose(false)}>
              Zavřít
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="vas@email.cz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Odeslat odkaz pro obnovení
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // Show one-time message when redirected here by idle auto-logout
  useEffect(() => {
    const fromIdle = consumeIdleLogoutFlag() || searchParams.get("reason") === "idle";
    if (fromIdle) {
      toast({
        title: "Byli jste odhlášeni",
        description: "Z důvodu neaktivity bylo vaše přihlášení ukončeno.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLockout(null);

    try {
      loginSchema.parse(loginData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsLoading(true);

    const { error } = await signIn(loginData.email, loginData.password);

    // After sign-in attempt, fetch detailed lockout status (works even if not locked yet)
    let lockInfo: LockoutInfo | null = null;
    try {
      const { data } = await supabase.rpc("get_account_lockout_status", {
        _email: loginData.email.trim().toLowerCase(),
      });
      if (data) lockInfo = data as unknown as LockoutInfo;
    } catch {
      // ignore — RPC unavailable on older DBs
    }

    setIsLoading(false);

    if (error) {
      // Account locked → show structured banner with exact unlock time
      if (lockInfo?.is_locked || error.name === "AccountLocked") {
        setLockout(lockInfo);
        return;
      }

      let errorMessage = "Přihlášení se nezdařilo. Zkontrolujte email a heslo.";

      if (error.message?.includes("Invalid login credentials")) {
        errorMessage = "Nesprávný email nebo heslo.";
      } else if (error.message?.includes("Email not confirmed")) {
        errorMessage = "Email nebyl potvrzen. Zkontrolujte svou emailovou schránku.";
      }

      // If user is approaching lockout, append warning
      if (lockInfo && lockInfo.failed_attempts >= Math.max(1, lockInfo.max_attempts - 2)) {
        const remaining = Math.max(0, lockInfo.max_attempts - lockInfo.failed_attempts);
        errorMessage +=
          remaining > 0
            ? ` Zbývá ${remaining} ${remaining === 1 ? "pokus" : remaining < 5 ? "pokusy" : "pokusů"} do uzamčení účtu.`
            : "";
      }

      toast({
        title: "Chyba přihlášení",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Přihlášení úspěšné",
      description: "Vítejte zpět!",
    });

    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex flex-col items-center justify-center mb-6 gap-2">
          <img src={companyLogo} alt="Engel Gematex" className="h-14 w-auto" />
          <h1 className="text-2xl font-bold text-primary">Lhůtník</h1>
        </div>

        {/* Lockout banner */}
        {lockout?.is_locked && (
          <Alert variant="destructive" className="mb-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Účet je dočasně uzamčen</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>
                <strong>Důvod:</strong> překročen povolený počet neúspěšných pokusů o přihlášení
                ({lockout.failed_attempts} z {lockout.max_attempts} povolených v okně{" "}
                {lockout.window_minutes} min).
              </p>
              <p>
                Účet je uzamčen na <strong>{lockout.lock_minutes} min</strong> a poté se{" "}
                <strong>automaticky odemkne</strong>.
              </p>
              {unlockCountdown && (
                <p className="font-medium">
                  Zbývá do odemčení: <span className="font-mono">{unlockCountdown}</span>
                </p>
              )}
              {lockout.unlock_at && (
                <p className="text-xs opacity-80">
                  Přesný čas odemčení: {new Date(lockout.unlock_at).toLocaleTimeString("cs-CZ")}
                </p>
              )}
              <p className="text-xs opacity-80">
                Pokud potřebujete přístup ihned, kontaktujte správce systému nebo zkuste samoodemčení.
              </p>
              <div className="pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSelfUnlock}
                  disabled={unlocking}
                >
                  {unlocking && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Odemknout účet
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Info about admin-only mode */}
        <div className="mb-4 p-3 bg-muted/50 border border-muted rounded-lg flex items-start gap-2">
          <Lock className="w-4 h-4 text-muted-foreground mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Účty vytváří pouze administrátor. Pokud potřebujete přístup, kontaktujte správce systému.
          </p>
        </div>

        {/* Only login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="vas@email.cz"
              value={loginData.email}
              onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
              required
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password">Heslo</Label>
            <Input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              required
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Přihlásit se
          </Button>

          <button
            type="button"
            onClick={() => setForgotPasswordOpen(true)}
            className="w-full text-center text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
          >
            Zapomenuté heslo?
          </button>
        </form>
      </Card>

      <ForgotPasswordDialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen} />
    </div>
  );
}
