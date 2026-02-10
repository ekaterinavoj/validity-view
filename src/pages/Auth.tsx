import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock } from "lucide-react";
import { z } from "zod";
import companyLogo from "@/assets/company-logo.jpg";

const loginSchema = z.object({
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
        <div className="flex items-center justify-center mb-6">
          <img src={companyLogo} alt="Engel Gematex" className="h-14 w-auto" />
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
        </form>
      </Card>
    </div>
  );
}
