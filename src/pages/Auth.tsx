import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Loader2, Lock } from "lucide-react";
import { z } from "zod";
import companyLogo from "@/assets/company-logo.png";

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

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

    setIsLoading(false);

    if (error) {
      let errorMessage = "Přihlášení se nezdařilo. Zkontrolujte email a heslo.";

      if (error.message?.includes("Invalid login credentials")) {
        errorMessage = "Nesprávný email nebo heslo.";
      } else if (error.message?.includes("Email not confirmed")) {
        errorMessage = "Email nebyl potvrzen. Zkontrolujte svou emailovou schránku.";
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
