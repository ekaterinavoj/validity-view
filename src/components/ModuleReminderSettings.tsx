import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { GraduationCap, Wrench, Stethoscope, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Per-module reminder settings (PER-RECORD alerts only — NOT aggregate summaries).
 * These act as defaults for new records. Each record can still override its own
 * remind_days_before / repeat_days_after / reminder_template_id.
 *
 * Stored in system_settings under keys:
 *   - alert_defaults_trainings
 *   - alert_defaults_deadlines
 *   - alert_defaults_medical
 */

interface ModuleAlertConfig {
  enabled: boolean;
  remind_days_before: number;
  repeat_days_after: number;
}

const DEFAULT_CONFIG: ModuleAlertConfig = {
  enabled: true,
  remind_days_before: 30,
  repeat_days_after: 30,
};

const MODULES = [
  {
    key: "alert_defaults_trainings",
    label: "Školení",
    icon: GraduationCap,
    description: "Výchozí nastavení per-záznam upozornění pro nová školení",
  },
  {
    key: "alert_defaults_deadlines",
    label: "Technické lhůty",
    icon: Wrench,
    description: "Výchozí nastavení per-záznam upozornění pro nové technické události",
  },
  {
    key: "alert_defaults_medical",
    label: "PLP – Pracovně lékařské prohlídky",
    icon: Stethoscope,
    description: "Výchozí nastavení per-záznam upozornění pro nové PLP",
  },
] as const;

export const ModuleReminderSettings = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, ModuleAlertConfig>>({
    alert_defaults_trainings: DEFAULT_CONFIG,
    alert_defaults_deadlines: DEFAULT_CONFIG,
    alert_defaults_medical: DEFAULT_CONFIG,
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", MODULES.map((m) => m.key));

      const next: Record<string, ModuleAlertConfig> = {
        alert_defaults_trainings: DEFAULT_CONFIG,
        alert_defaults_deadlines: DEFAULT_CONFIG,
        alert_defaults_medical: DEFAULT_CONFIG,
      };

      for (const row of data || []) {
        if (row.value && typeof row.value === "object") {
          next[row.key] = { ...DEFAULT_CONFIG, ...(row.value as Partial<ModuleAlertConfig>) };
        }
      }
      setConfigs(next);
    } catch (e: any) {
      toast({
        title: "Chyba načítání",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (key: string) => {
    setSaving(key);
    try {
      const { error } = await supabase
        .from("system_settings")
        .upsert({ key, value: configs[key] as any }, { onConflict: "key" });
      if (error) throw error;
      toast({ title: "Uloženo", description: `Nastavení modulu bylo aktualizováno.` });
    } catch (e: any) {
      toast({ title: "Chyba uložení", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const updateConfig = (key: string, patch: Partial<ModuleAlertConfig>) => {
    setConfigs((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {MODULES.map((mod) => {
        const Icon = mod.icon;
        const cfg = configs[mod.key];
        return (
          <Card key={mod.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="w-5 h-5" />
                Per-záznam upozornění – {mod.label}
              </CardTitle>
              <CardDescription>{mod.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Povolit per-záznam upozornění</Label>
                  <p className="text-sm text-muted-foreground">
                    Při vypnutí systém přestane odesílat individuální upozornění pro tento modul
                  </p>
                </div>
                <Switch
                  checked={cfg.enabled}
                  onCheckedChange={(v) => updateConfig(mod.key, { enabled: v })}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Výchozí dny před vypršením</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={cfg.remind_days_before}
                    onChange={(e) =>
                      updateConfig(mod.key, {
                        remind_days_before: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Výchozí hodnota pro nové záznamy. Lze přepsat per záznam.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Výchozí opakování (dny)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    value={cfg.repeat_days_after}
                    onChange={(e) =>
                      updateConfig(mod.key, {
                        repeat_days_after: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Po kolika dnech se připomínka opakuje (0 = neopakuje se).
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => saveConfig(mod.key)}
                  disabled={saving === mod.key}
                >
                  {saving === mod.key ? (
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
      })}
    </div>
  );
};
