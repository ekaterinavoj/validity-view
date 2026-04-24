import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Clock } from "lucide-react";

interface Config {
  enabled: boolean;
  idle_minutes: number;
  warn_seconds_before: number;
}

const DEFAULT: Config = { enabled: true, idle_minutes: 60, warn_seconds_before: 300 };

export function SessionTimeoutSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<Config>(DEFAULT);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "session_timeout")
        .maybeSingle();
      const v = (data?.value ?? null) as Partial<Config> | null;
      if (v) setCfg({ ...DEFAULT, ...v });
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const idle = Math.max(1, Math.min(720, Number(cfg.idle_minutes) || 60));
      const warn = Math.max(0, Math.min(idle * 60 - 1, Number(cfg.warn_seconds_before) || 0));
      const value = { enabled: !!cfg.enabled, idle_minutes: idle, warn_seconds_before: warn };
      const { error } = await supabase
        .from("system_settings")
        .upsert({ key: "session_timeout", value }, { onConflict: "key" });
      if (error) throw error;
      setCfg(value);
      toast({ title: "Uloženo", description: "Nastavení odhlášení bylo aktualizováno." });
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message ?? "Nepodařilo se uložit.", variant: "destructive" });
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
          <Clock className="w-5 h-5" /> Automatické odhlášení po neaktivitě
        </CardTitle>
        <CardDescription>
          Z bezpečnostních důvodů odhlásí uživatele, pokud delší dobu neinteragují s aplikací.
          Před vypršením se zobrazí upozornění s možností prodloužit přihlášení.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 p-3 border rounded-md">
          <div>
            <Label htmlFor="st-enabled" className="text-base">Funkce zapnuta</Label>
            <p className="text-xs text-muted-foreground">Týká se všech přihlášených uživatelů.</p>
          </div>
          <Switch
            id="st-enabled"
            checked={cfg.enabled}
            onCheckedChange={(v) => setCfg((c) => ({ ...c, enabled: v }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="st-idle">Doba neaktivity do odhlášení (min)</Label>
            <Input
              id="st-idle"
              type="number"
              min={1}
              max={720}
              value={cfg.idle_minutes}
              onChange={(e) => setCfg((c) => ({ ...c, idle_minutes: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">Doporučeno 30–60 minut pro citlivá data.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="st-warn">Varování před odhlášením (sekundy)</Label>
            <Input
              id="st-warn"
              type="number"
              min={0}
              value={cfg.warn_seconds_before}
              onChange={(e) => setCfg((c) => ({ ...c, warn_seconds_before: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">300 s = upozornění 5 minut předem.</p>
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
