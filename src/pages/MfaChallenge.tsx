import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";

export default function MfaChallenge() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyMfaCode, signOut } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Zadejte 6místný kód z aplikace");
      return;
    }

    setIsLoading(true);
    const { error: verifyError } = await verifyMfaCode(trimmed);
    setIsLoading(false);

    if (verifyError) {
      setError("Nesprávný nebo expirovaný kód. Zkuste to znovu.");
      setCode("");
      return;
    }

    toast({ title: "Ověřeno", description: "Dvoufázové ověření dokončeno." });
    // Return to wherever ProtectedRoute intercepted the user (e.g. a password
    // recovery link landing on /change-password) instead of always "/" —
    // otherwise a pending password reset would get silently skipped.
    const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
    navigate(from ? `${from.pathname}${from.search || ""}` : "/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Dvoufázové ověření</h1>
            <p className="text-sm text-muted-foreground">
              Zadejte 6místný kód z vaší aplikace (Google Authenticator, Microsoft Authenticator apod.).
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Ověřovací kód</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
              className="text-center text-lg tracking-[0.3em]"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ověřit
          </Button>

          <button
            type="button"
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-3.5 h-3.5" />
            Odhlásit se
          </button>
        </form>
      </Card>
    </div>
  );
}
