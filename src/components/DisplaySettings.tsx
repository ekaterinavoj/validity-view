import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { 
  Monitor, 
  Moon, 
  Sun, 
  Minimize2, 
  Sparkles, 
  Table, 
  LayoutGrid, 
  RefreshCw,
  RotateCcw,
  Bell,
  Volume2,
  AlertTriangle,
  BadgeCheck
} from "lucide-react";
import { useUserPreferences, UserPreferences } from "@/hooks/useUserPreferences";
import { useToast } from "@/hooks/use-toast";

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ icon, label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function DisplaySettings() {
  const { preferences, updatePreference, resetPreferences } = useUserPreferences();
  const { toast } = useToast();

  const handleReset = () => {
    resetPreferences();
    toast({
      title: "Nastavení obnoveno",
      description: "Všechna nastavení byla vrácena na výchozí hodnoty.",
    });
  };

  const themeOptions = [
    { value: "light", label: "Světlý", icon: <Sun className="w-4 h-4" /> },
    { value: "dark", label: "Tmavý", icon: <Moon className="w-4 h-4" /> },
    { value: "system", label: "Systémový", icon: <Monitor className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Theme & Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="w-5 h-5" />
            Vzhled
          </CardTitle>
          <CardDescription>
            Přizpůsobte si vzhled aplikace podle svých preferencí
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <SettingRow
            icon={<Monitor className="w-4 h-4" />}
            label="Barevný režim"
            description="Zvolte světlý, tmavý nebo systémový režim"
          >
            <Select
              value={preferences.theme}
              onValueChange={(value: UserPreferences["theme"]) => 
                updatePreference("theme", value)
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>

          <Separator />

          <SettingRow
            icon={<Minimize2 className="w-4 h-4" />}
            label="Kompaktní režim"
            description="Menší odsazení a velikost písma pro více obsahu"
          >
            <Switch
              checked={preferences.compactMode}
              onCheckedChange={(checked) => updatePreference("compactMode", checked)}
            />
          </SettingRow>

          <Separator />

          <SettingRow
            icon={<Sparkles className="w-4 h-4" />}
            label="Animace"
            description="Zapnout animace a přechody v rozhraní"
          >
            <Switch
              checked={preferences.animationsEnabled}
              onCheckedChange={(checked) => updatePreference("animationsEnabled", checked)}
            />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Table & List Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Table className="w-5 h-5" />
            Zobrazení dat
          </CardTitle>
          <CardDescription>
            Nastavení tabulek a seznamů
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <SettingRow
            icon={<LayoutGrid className="w-4 h-4" />}
            label="Výchozí zobrazení"
            description="Preferované zobrazení seznamů"
          >
            <Select
              value={preferences.defaultView}
              onValueChange={(value: UserPreferences["defaultView"]) => 
                updatePreference("defaultView", value)
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4" />
                    Tabulka
                  </div>
                </SelectItem>
                <SelectItem value="cards">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" />
                    Karty
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <Separator />

          <SettingRow
            icon={<Table className="w-4 h-4" />}
            label="Položek na stránku"
            description="Počet zobrazených položek v tabulkách"
          >
            <Select
              value={preferences.itemsPerPage.toString()}
              onValueChange={(value) => 
                updatePreference("itemsPerPage", parseInt(value))
              }
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>

          <Separator />

          <SettingRow
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Prošlé nahoře"
            description="Řadit prošlá školení na začátek seznamu"
          >
            <Switch
              checked={preferences.showExpiredFirst}
              onCheckedChange={(checked) => updatePreference("showExpiredFirst", checked)}
            />
          </SettingRow>

          <Separator />

          <SettingRow
            icon={<RefreshCw className="w-4 h-4" />}
            label="Automatické obnovení"
            description="Automaticky obnovovat data na pozadí"
          >
            <Switch
              checked={preferences.autoRefresh}
              onCheckedChange={(checked) => updatePreference("autoRefresh", checked)}
            />
          </SettingRow>

          {preferences.autoRefresh && (
            <>
              <Separator />
              <SettingRow
                icon={<RefreshCw className="w-4 h-4" />}
                label="Interval obnovení"
                description="Jak často obnovovat data"
              >
                <Select
                  value={preferences.autoRefreshInterval.toString()}
                  onValueChange={(value) => 
                    updatePreference("autoRefreshInterval", parseInt(value))
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 s</SelectItem>
                    <SelectItem value="60">1 min</SelectItem>
                    <SelectItem value="120">2 min</SelectItem>
                    <SelectItem value="300">5 min</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notifications & Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Upozornění
          </CardTitle>
          <CardDescription>
            Nastavení notifikací a zvýraznění
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <SettingRow
            icon={<BadgeCheck className="w-4 h-4" />}
            label="Stavové štítky"
            description="Zobrazovat barevné štítky stavu školení"
          >
            <Switch
              checked={preferences.showStatusBadges}
              onCheckedChange={(checked) => updatePreference("showStatusBadges", checked)}
            />
          </SettingRow>

          <Separator />

          <SettingRow
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Zvýraznit naléhavé"
            description="Vizuálně zvýraznit školení vyžadující pozornost"
          >
            <Switch
              checked={preferences.highlightUrgent}
              onCheckedChange={(checked) => updatePreference("highlightUrgent", checked)}
            />
          </SettingRow>

          <Separator />

          <SettingRow
            icon={<Volume2 className="w-4 h-4" />}
            label="Zvukové upozornění"
            description="Přehrát zvuk při důležitých událostech"
          >
            <Switch
              checked={preferences.soundEnabled}
              onCheckedChange={(checked) => updatePreference("soundEnabled", checked)}
            />
          </SettingRow>

          <Separator />

          <SettingRow
            icon={<Bell className="w-4 h-4" />}
            label="Rychlé statistiky"
            description="Zobrazovat přehled na dashboardu"
          >
            <Switch
              checked={preferences.showQuickStats}
              onCheckedChange={(checked) => updatePreference("showQuickStats", checked)}
            />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Reset Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Obnovit výchozí nastavení
        </Button>
      </div>
    </div>
  );
}
