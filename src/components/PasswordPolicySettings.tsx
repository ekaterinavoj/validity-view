import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, KeyRound } from "lucide-react";
import { DEFAULT_PASSWORD_POLICY, type PasswordPolicy } from "@/lib/passwordStrength";

export function PasswordPolicySettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "password_policy")
        .maybeSingle();
      const v = (data?.value ?? null) as Partial<PasswordPolicy> | null;
      if (v) setCfg({ ...DEFAULT_PASSWORD_POLICY, ...v });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const value: PasswordPolicy = {
        min_length: Math.max(6, Math.min(64, Number(cfg.min_length) || 10)),
        require_uppercase: !!cfg.require_uppercase,
        require_lowercase: !!cfg.require_lowercase,
        require_digit: !!cfg.require_digit,
        require_special: !!cfg.require_special,
        max_age_enabled: !!cfg.max_age_enabled,
        max_age_days: Math.max(1, Math.min(3650, Number(cfg.max_age_days) || 90)),
      };
      const { error } = await supabase
        .from("system_settings")
        .upsert({ key: "password_policy", value }, { onConflict: "key" });
      if (error) throw error;
      setCfg(value);
      toast({ title: "Uloženo", description: "Pravidla pro hesla byla aktualizována." });
    } catch (e: any) {
      toast({
        title: "Chyba",
        description: e?.message ?? "Nepodařilo se uložit pravidla.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5" /> Pravidla pro hesla
        </CardTitle>
        <CardDescription>
          Tato pravidla se používají pro validaci nových hesel i pro zobrazení v dialogu
          „Doporučujeme změnit heslo“. Změny se projeví okamžitě pro všechny uživatele.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Strength rules */}
        <div className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="pp-len">Minimální délka hesla</Label>
            <Input
              id="pp-len"
              type="number"
              min={6}
              max={64}
              value={cfg.min_length}
              onChange={(e) => setCfg((c) => ({ ...c, min_length: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">Doporučeno alespoň 10 znaků.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToggleRow
              id="pp-upper"
              label="Vyžadovat velké písmeno (A–Z)"
              checked={cfg.require_uppercase}
              onChange={(v) => setCfg((c) => ({ ...c, require_uppercase: v }))}
            />
            <ToggleRow
              id="pp-lower"
              label="Vyžadovat malé písmeno (a–z)"
              checked={cfg.require_lowercase}
              onChange={(v) => setCfg((c) => ({ ...c, require_lowercase: v }))}
            />
            <ToggleRow
              id="pp-digit"
              label="Vyžadovat číslici (0–9)"
              checked={cfg.require_digit}
              onChange={(v) => setCfg((c) => ({ ...c, require_digit: v }))}
            />
            <ToggleRow
              id="pp-special"
              label="Vyžadovat speciální znak (!@#$…)"
              checked={cfg.require_special}
              onChange={(v) => setCfg((c) => ({ ...c, require_special: v }))}
            />
          </div>
        </div>

        <Separator />

        {/* Max age */}
        <div className="space-y-3">
          <ToggleRow
            id="pp-age-enabled"
            label="Vynutit změnu hesla po N dnech"
            description="Pokud zapnuto, uživatelé se starým heslem dostanou po přihlášení dialog s doporučením změny. Pokud vypnuto, chování zůstává stejné jako dosud (kontrola pouze podle příznaku v profilu)."
            checked={cfg.max_age_enabled}
            onChange={(v) => setCfg((c) => ({ ...c, max_age_enabled: v }))}
          />

          <div className="space-y-2 max-w-xs">
            <Label htmlFor="pp-age-days">Maximální stáří hesla (dny)</Label>
            <Input
              id="pp-age-days"
              type="number"
              min={1}
              max={3650}
              disabled={!cfg.max_age_enabled}
              value={cfg.max_age_days}
              onChange={(e) => setCfg((c) => ({ ...c, max_age_days: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">Výchozí 90 dní.</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Uložit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 border rounded-md">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
