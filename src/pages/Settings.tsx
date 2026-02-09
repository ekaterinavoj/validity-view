import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Mail, Bell, Clock, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const Settings = () => {
  const { toast } = useToast();
  
  // Načíst nastavení z localStorage
  const loadSettings = () => {
    const saved = localStorage.getItem('systemSettings');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      emailNotificationsEnabled: false,
      defaultRemindDaysBefore: 30,
      defaultRepeatDaysAfter: 365,
      notificationCheckInterval: '0 8 * * *', // každý den v 8:00
    };
  };

  const [settings, setSettings] = useState(loadSettings());

  const handleSave = () => {
    localStorage.setItem('systemSettings', JSON.stringify(settings));
    toast({
      title: "Nastavení uloženo",
      description: "Vaše nastavení bylo úspěšně uloženo.",
    });
  };

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-8 h-8 text-primary" />
        <h2 className="text-3xl font-bold text-foreground">Nastavení systému</h2>
      </div>

      <div className="grid gap-6">
        {/* Emailové notifikace */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <CardTitle>Emailové notifikace</CardTitle>
            </div>
            <CardDescription>
              Konfigurace automatických emailových upozornění na expirující školení
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-enabled">Povolit emailové notifikace</Label>
                <p className="text-sm text-muted-foreground">
                  Zasílat automatické připomínky o končících školeních
                </p>
              </div>
              <Switch
                id="email-enabled"
                checked={settings.emailNotificationsEnabled}
                onCheckedChange={(checked) => updateSetting('emailNotificationsEnabled', checked)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Status SMTP serveru</Label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Pro odesílání emailů je potřeba nastavit SMTP server v Administraci → Nastavení → E-mail.
                  </p>
                </div>
              </div>
            </div>

            {settings.emailNotificationsEnabled && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="check-interval">Interval kontroly (cron formát)</Label>
                  <Input
                    id="check-interval"
                    value={settings.notificationCheckInterval}
                    onChange={(e) => updateSetting('notificationCheckInterval', e.target.value)}
                    placeholder="0 8 * * *"
                  />
                  <p className="text-xs text-muted-foreground">
                    Příklady: "0 8 * * *" = každý den v 8:00, "0 */6 * * *" = každých 6 hodin
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Výchozí intervaly */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <CardTitle>Výchozí intervaly</CardTitle>
            </div>
            <CardDescription>
              Nastavení výchozích intervalů pro nová školení
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remind-days">Připomínka před vypršením (dny)</Label>
              <Input
                id="remind-days"
                type="number"
                min="1"
                value={settings.defaultRemindDaysBefore}
                onChange={(e) => updateSetting('defaultRemindDaysBefore', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Kolik dní před vypršením školení má být odeslána připomínka
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repeat-days">Interval opakování školení (dny)</Label>
              <Input
                id="repeat-days"
                type="number"
                min="1"
                value={settings.defaultRepeatDaysAfter}
                onChange={(e) => updateSetting('defaultRepeatDaysAfter', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Výchozí počet dní po kterých má být školení opakováno (např. 365 pro roční školení)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Připomínky */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <CardTitle>Šablona připomínek</CardTitle>
            </div>
            <CardDescription>
              Informace o automatických připomínkách
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Systém automaticky kontroluje školení, kterým brzy vyprší platnost podle nastaveného
                intervalu "Připomínka před vypršením".
              </p>
              <p>
                Pro každé školení s končící platností bude zaslán email na adresu zaměstnance
                s upozorněním na nutnost opakování školení.
              </p>
              <p className="font-medium text-foreground">
                Pro aktivaci emailových notifikací je nutné:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Nakonfigurovat SMTP server v Administraci (Nastavení → E-mail)</li>
                <li>Povolit emailové notifikace výše</li>
                <li>Otestovat odesílání testovacím emailem</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Tlačítko pro uložení */}
        <div className="flex justify-end">
          <Button onClick={handleSave} size="lg">
            <Save className="w-4 h-4 mr-2" />
            Uložit nastavení
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
