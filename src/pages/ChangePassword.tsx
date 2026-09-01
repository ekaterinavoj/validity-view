import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { validatePassword, PASSWORD_POLICY_HINT } from "@/lib/passwordPolicy";

const passwordSchema = z.object({
  password: z.string().superRefine((password, ctx) => {
    const errors = validatePassword(password);
    if (errors.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: errors.join(" ") });
    }
  }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Hesla se neshodují",
  path: ["confirmPassword"],
});

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { policy } = usePasswordPolicy();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const evaluation = evaluatePassword(formData.password, policy);
  const canSubmit =
    evaluation.meetsMinimum &&
    formData.password.length > 0 &&
    formData.password === formData.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      buildPasswordSchema(policy).parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0].toString()] = err.message;
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsLoading(true);
    try {
      // Update password via Supabase Auth (HIBP check enforced server-side)
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (updateError) {
        // Surface friendlier message for HIBP / weak-password rejection
        const msg = updateError.message ?? "";
        if (/pwned|breach|leaked|weak/i.test(msg)) {
          throw new Error(
            "Toto heslo bylo nalezeno v databázi uniklých hesel. Zvolte prosím jiné, silnější heslo."
          );
        }
        throw updateError;
      }

      // Clear must_change_password flag and stamp password_updated_at via RPC
      if (user) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false } as any)
          .eq("id", user.id);
        // Reset password review flag (new password meets policy thanks to client-side validation + HIBP)
        try {
          await supabase.rpc("mark_password_reviewed" as any);
        } catch (e) {
          console.warn("mark_password_reviewed failed (non-critical):", e);
        }
      }

      await refreshProfile();

      toast({
        title: "Heslo změněno",
        description: "Vaše heslo bylo úspěšně změněno.",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Chyba při změně hesla",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <div>
            <h1 className="text-xl font-bold">
              {profile?.must_change_password ? "Změna hesla vyžadována" : "Nastavení nového hesla"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {profile?.must_change_password
                ? "Vaše heslo bylo resetováno administrátorem. Zadejte prosím nové heslo."
                : "Zadejte nové heslo ke svému účtu."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nové heslo</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            <PasswordStrengthMeter password={formData.password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Potvrzení hesla</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              autoComplete="new-password"
              required
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || !canSubmit}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Změnit heslo
          </Button>
        </form>
      </Card>
    </div>
  );
}
