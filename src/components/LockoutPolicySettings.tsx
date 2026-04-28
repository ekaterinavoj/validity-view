import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, ShieldAlert } from "lucide-react";

interface Policy {
  max_attempts: number;
  window_minutes: number;
  duration_minutes: number;
}

const DEFAULT: Policy = { max_attempts: 5, window_minutes: 15, duration_minutes: 15 };

export function LockoutPolicySettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<Policy>(DEFAULT);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc("get_lockout_policy");
      if (!error && data) {
        const v = data as unknown as Policy;
        setCfg({ ...DEFAULT, ...v });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const max = Math.max(1, Math.min(50, Number(cfg.max_attempts) || 5));
      const win = Math.max(1, Math.min(1440, Number(cfg.window_minutes) || 15));
      const dur = Math.max(1, Math.min(1440, Number(cfg.duration_minutes) || 15));
      const { error } = await supabase.rpc("admin_update_lockout_policy", {
        _max_attempts: max,
        _window_minutes: win,
        _duration_minutes: dur,
      });
      if (error) throw error;
      setCfg({ max_attempts: max, window_minutes: win, duration_minutes: dur });
      toast({ title: "Uloženo", description: "Pravidla uzamčení účtu byla aktualizována." });
    } catch (e: any) {
      toast({
        title: "Chyba",
        description: e?.message ?? "Nepodařilo se uložit.",
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
          <ShieldAlert className="w-5 h-5" /> Uzamčení účtu po neúspěšných pokusech
        </CardTitle>
        <CardDescription>
          Pokud někdo zadá špatné heslo víckrát, účet se dočasně uzamkne. Po uplynutí doby
          uzamčení se účet automaticky odemkne. Změny se okamžitě promítnou na přihlašovací
          obrazovku.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lp-max">Max. neúspěšných pokusů</Label>
            <Input
              id="lp-max"
              type="number"
              min={1}
              max={50}
              value={cfg.max_attempts}
              onChange={(e) => setCfg((c) => ({ ...c, max_attempts: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              Po dosažení tohoto počtu se účet uzamkne (1–50).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lp-win">Okno sledování (min)</Label>
            <Input
              id="lp-win"
              type="number"
              min={1}
              max={1440}
              value={cfg.window_minutes}
              onChange={(e) => setCfg((c) => ({ ...c, window_minutes: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              Počítají se neúspěchy z posledních N minut (1–1440).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lp-dur">Doba uzamčení (min)</Label>
            <Input
              id="lp-dur"
              type="number"
              min={1}
              max={1440}
              value={cfg.duration_minutes}
              onChange={(e) => setCfg((c) => ({ ...c, duration_minutes: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              Po této době se účet automaticky odemkne (1–1440).
            </p>
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Aktuální pravidlo: po <strong>{cfg.max_attempts}</strong> neúspěšných pokusech v okně{" "}
          <strong>{cfg.window_minutes} min</strong> se účet uzamkne na{" "}
          <strong>{cfg.duration_minutes} min</strong>.
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Uložit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
