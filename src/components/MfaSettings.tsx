import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { ShieldCheck, ShieldOff, Loader2, KeyRound } from "lucide-react";

type EnrollStep = "idle" | "enrolling" | "verifying";
interface TotpFactor {
  id: string;
  status: string;
}

export function MfaSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verifiedFactor, setVerifiedFactor] = useState<TotpFactor | null>(null);
  const [step, setStep] = useState<EnrollStep>("idle");
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  const loadFactors = useCallback(async () => {
    setLoading(true);
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      console.error("Error listing MFA factors:", listError);
    } else {
      setVerifiedFactor(data?.totp?.find((f) => f.status === "verified") || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  const startEnroll = async () => {
    setError("");
    setBusy(true);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().toLocaleDateString("cs-CZ")}`,
      });
      if (enrollError) throw enrollError;

      setPendingFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStep("enrolling");
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message || "Nepodařilo se zahájit nastavení", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = async () => {
    if (pendingFactorId) {
      // Best-effort cleanup — an unverified factor left behind is harmless
      // (never usable for login) but no reason to leave clutter.
      await supabase.auth.mfa.unenroll({ factorId: pendingFactorId }).catch(() => {});
    }
    setStep("idle");
    setPendingFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode("");
    setError("");
  };

  const confirmEnroll = async () => {
    if (!pendingFactorId) return;
    setError("");

    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Zadejte 6místný kód z aplikace");
      return;
    }

    setBusy(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: pendingFactorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId,
        challengeId: challengeData.id,
        code: trimmed,
      });
      if (verifyError) throw verifyError;

      toast({ title: "Hotovo", description: "Dvoufázové ověření bylo aktivováno." });
      setStep("idle");
      setPendingFactorId(null);
      setQrCode(null);
      setSecret(null);
      setCode("");
      await loadFactors();
    } catch (err: any) {
      setError("Nesprávný kód. Zkontrolujte čas v telefonu a zkuste to znovu.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!verifiedFactor) return;
    setBusy(true);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
      if (unenrollError) throw unenrollError;
      toast({ title: "Odebráno", description: "Dvoufázové ověření bylo vypnuto." });
      setRemoveDialogOpen(false);
      await loadFactors();
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message || "Nepodařilo se odebrat dvoufázové ověření", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Načítám stav dvoufázového ověření...
      </div>
    );
  }

  if (step === "enrolling") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Naskenujte QR kód aplikací Google Authenticator, Microsoft Authenticator nebo podobnou, a poté zadejte 6místný kód, který vám vygeneruje.
        </p>
        {qrCode && (
          <div className="flex justify-center p-4 bg-white rounded-lg border w-fit mx-auto">
            <img src={qrCode} alt="QR kód pro nastavení dvoufázového ověření" className="w-48 h-48" />
          </div>
        )}
        {secret && (
          <p className="text-xs text-muted-foreground text-center">
            Nejde naskenovat? Zadejte ručně: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{secret}</code>
          </p>
        )}
        <div className="space-y-2 max-w-xs mx-auto">
          <Label htmlFor="mfa-enroll-code">Ověřovací kód</Label>
          <Input
            id="mfa-enroll-code"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-lg tracking-[0.3em]"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={cancelEnroll} disabled={busy}>
            Zrušit
          </Button>
          <Button onClick={confirmEnroll} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Aktivovat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {verifiedFactor ? (
        <>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="font-medium">Dvoufázové ověření je aktivní</span>
            <Badge variant="secondary">Zapnuto</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Při přihlášení budete kromě hesla muset zadat i kód z autentifikační aplikace.
          </p>
          <Button variant="outline" onClick={() => setRemoveDialogOpen(true)}>
            <ShieldOff className="w-4 h-4 mr-2" />
            Vypnout dvoufázové ověření
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Dvoufázové ověření přidává druhou vrstvu zabezpečení — kromě hesla se při přihlášení ověří i kódem z aplikace ve vašem telefonu (Google Authenticator, Microsoft Authenticator apod.).
          </p>
          <Button onClick={startEnroll} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
            Nastavit dvoufázové ověření
          </Button>
        </>
      )}

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vypnout dvoufázové ověření?</AlertDialogTitle>
            <AlertDialogDescription>
              Při dalším přihlášení už nebudete muset zadávat kód z aplikace — bude stačit heslo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Vypnout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
