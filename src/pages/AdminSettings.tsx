import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Settings, Mail, Clock, Users, Database, Save, Plus, X, Eye, EyeOff, AlertCircle, UserCheck, Calendar, Shield, History, UserPlus } from "lucide-react";
import { RolePermissionsInfo } from "@/components/RolePermissionsInfo";
import { SendTestSummaryEmail } from "@/components/SendTestSummaryEmail";
import { SendSingleTestEmail } from "@/components/SendSingleTestEmail";
import { EmailHistory } from "@/components/EmailHistory";
import { EmailTemplatePreview } from "@/components/EmailTemplatePreview";
import { NextSendPreview } from "@/components/NextSendPreview";
import { UserManagementPanel } from "@/components/UserManagementPanel";
import { OnboardingSettings } from "@/components/OnboardingSettings";
import { PendingUsersPanel } from "@/components/PendingUsersPanel";
import { UserInvitePanel } from "@/components/UserInvitePanel";

interface SystemSetting {
  id: string;
  key: string;
  value: any;
  description: string;
}

interface UserWithRole {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Neděle" },
  { value: 1, label: "Pondělí" },
  { value: 2, label: "Úterý" },
  { value: 3, label: "Středa" },
  { value: 4, label: "Čtvrtek" },
  { value: 5, label: "Pátek" },
  { value: 6, label: "Sobota" },
];

const FREQUENCY_PRESETS = [
  { value: "daily", label: "Denně", days: 1 },
  { value: "weekly", label: "Týdně", days: 7 },
  { value: "biweekly", label: "Každé 2 týdny", days: 14 },
  { value: "monthly", label: "Měsíčně", days: 30 },
  { value: "custom", label: "Vlastní interval", days: null },
];

const TIMEZONES = [
  { value: "Europe/Prague", label: "Praha (CET/CEST)" },
  { value: "Europe/London", label: "Londýn (GMT/BST)" },
  { value: "Europe/Berlin", label: "Berlín (CET/CEST)" },
  { value: "UTC", label: "UTC" },
];

const DELIVERY_MODES = [
  { value: "bcc", label: "BCC (skrytá kopie)" },
  { value: "to", label: "To (příjemci viditelní)" },
  { value: "cc", label: "CC (kopie)" },
];

const TEMPLATE_VARIABLES = [
  { var: "{totalCount}", desc: "Celkový počet školení" },
  { var: "{expiringCount}", desc: "Počet brzy vypršujících" },
  { var: "{expiredCount}", desc: "Počet prošlých" },
  { var: "{reportDate}", desc: "Datum reportu" },
];

export default function AdminSettings() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  
  // Settings state
  const [reminderSchedule, setReminderSchedule] = useState({
    enabled: true,
    day_of_week: 1,
    time: "08:00",
    skip_weekends: true,
  });
  
  const [reminderDays, setReminderDays] = useState({
    days_before: [30, 14, 7],
  });
  
  const [reminderFrequency, setReminderFrequency] = useState({
    type: "weekly" as string,
    interval_days: 7,
    start_time: "08:00",
    timezone: "Europe/Prague",
    enabled: true, // New field to pause reminders without changing cron
  });
  
  const [reminderRecipients, setReminderRecipients] = useState({
    user_ids: [] as string[],
    delivery_mode: "bcc" as string,
  });
  
  const [emailProvider, setEmailProvider] = useState({
    provider: "resend",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_from_email: "",
    smtp_from_name: "Training System",
    smtp_secure: true,
    smtp_tls_mode: "starttls",
    smtp_ignore_tls: false,
  });
  
  const [emailTemplate, setEmailTemplate] = useState({
    subject: "Souhrn školení k obnovení - {reportDate}",
    body: "Dobrý den,\n\nzasíláme přehled školení vyžadujících pozornost.\n\nCelkem: {totalCount} školení\n- Brzy vypršuje: {expiringCount}\n- Prošlé: {expiredCount}\n\nPodrobný seznam naleznete v příloze níže.\n\nS pozdravem,\nVáš systém školení",
  });
  
  const [newDayBefore, setNewDayBefore] = useState("");
  
  // Users state
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    loadSettings();
    loadUsers();
  }, [isAdmin, navigate]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*");
      
      if (error) throw error;
      
      data?.forEach((setting: SystemSetting) => {
        switch (setting.key) {
          case "reminder_schedule":
            setReminderSchedule(setting.value);
            break;
          case "reminder_days":
            setReminderDays(setting.value);
            break;
          case "reminder_frequency":
            setReminderFrequency(prev => ({ ...prev, ...setting.value }));
            break;
          case "reminder_recipients":
            setReminderRecipients(prev => ({ ...prev, ...setting.value }));
            break;
          case "email_provider":
            setEmailProvider(setting.value);
            break;
          case "email_template":
            setEmailTemplate(setting.value);
            break;
        }
      });
    } catch (error: any) {
      toast({
        title: "Chyba při načítání nastavení",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name");
      
      if (profilesError) throw profilesError;
      
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      
      if (rolesError) throw rolesError;
      
      const usersWithRoles = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          role: userRole?.role || "user",
          is_active: true,
        };
      }) || [];
      
      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání uživatelů",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const saveSetting = async (key: string, value: any) => {
    // Try update first
    const { data: existing } = await supabase
      .from("system_settings")
      .select("id")
      .eq("key", key)
      .maybeSingle();
    
    if (existing) {
      const { error } = await supabase
        .from("system_settings")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("system_settings")
        .insert({ key, value, description: `Setting: ${key}` });
      if (error) throw error;
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting("reminder_schedule", reminderSchedule),
        saveSetting("reminder_days", reminderDays),
        saveSetting("reminder_frequency", reminderFrequency),
        saveSetting("reminder_recipients", reminderRecipients),
        saveSetting("email_provider", emailProvider),
        saveSetting("email_template", emailTemplate),
      ]);
      
      toast({
        title: "Nastavení uloženo",
        description: "Všechna nastavení byla úspěšně uložena.",
      });
    } catch (error: any) {
      toast({
        title: "Chyba při ukládání",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddDayBefore = () => {
    const day = parseInt(newDayBefore);
    if (day > 0 && !reminderDays.days_before.includes(day)) {
      setReminderDays({
        days_before: [...reminderDays.days_before, day].sort((a, b) => b - a),
      });
      setNewDayBefore("");
    }
  };

  const handleRemoveDayBefore = (day: number) => {
    setReminderDays({
      days_before: reminderDays.days_before.filter(d => d !== day),
    });
  };

  const handleFrequencyPresetChange = (preset: string) => {
    const selectedPreset = FREQUENCY_PRESETS.find(p => p.value === preset);
    if (selectedPreset) {
      setReminderFrequency(prev => ({
        ...prev,
        type: preset,
        interval_days: selectedPreset.days ?? prev.interval_days,
      }));
    }
  };

  const handleRecipientToggle = (userId: string, checked: boolean) => {
    setReminderRecipients(prev => ({
      ...prev,
      user_ids: checked 
        ? [...prev.user_ids, userId]
        : prev.user_ids.filter(id => id !== userId),
    }));
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole as "admin" | "manager" | "user" });
      
      if (error) throw error;
      
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      
      toast({
        title: "Role změněna",
        description: "Role uživatele byla úspěšně změněna.",
      });
    } catch (error: any) {
      toast({
        title: "Chyba při změně role",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getSelectedRecipientsDisplay = () => {
    const selected = users.filter(u => reminderRecipients.user_ids.includes(u.id));
    if (selected.length === 0) return "Žádní příjemci";
    if (selected.length <= 2) {
      return selected.map(u => `${u.first_name} ${u.last_name}`).join(", ");
    }
    return `${selected.length} příjemců`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-3xl font-bold text-foreground">Administrace</h2>
            <p className="text-muted-foreground">Nastavení systému a správa uživatelů</p>
          </div>
        </div>
        <Button onClick={handleSaveAll} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Uložit vše
        </Button>
      </div>

      <Tabs defaultValue="onboarding" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="onboarding" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Onboarding
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Připomínky
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Emaily
          </TabsTrigger>
          <TabsTrigger value="user-management" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Správa uživatelů
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Příjemci
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Data
          </TabsTrigger>
        </TabsList>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="space-y-6">
          <OnboardingSettings />
          <PendingUsersPanel />
          <UserInvitePanel />
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-6">
          {/* Recipients Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Příjemci připomínek
              </CardTitle>
              <CardDescription>
                Vyberte uživatele, kteří budou dostávat souhrnné emaily s přehledem školení
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>Vybraní příjemci</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getSelectedRecipientsDisplay()}
                  </p>
                </div>
                <div className="w-48">
                  <Label>Způsob doručení</Label>
                  <Select
                    value={reminderRecipients.delivery_mode}
                    onValueChange={(value) => 
                      setReminderRecipients({ ...reminderRecipients, delivery_mode: value })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="mb-2 block">Vybrat příjemce z uživatelů systému</Label>
                <ScrollArea className="h-[200px] border rounded-md p-3">
                  {usersLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {users.map((user) => (
                        <div 
                          key={user.id} 
                          className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md"
                        >
                          <Checkbox
                            id={`recipient-${user.id}`}
                            checked={reminderRecipients.user_ids.includes(user.id)}
                            onCheckedChange={(checked) => 
                              handleRecipientToggle(user.id, checked as boolean)
                            }
                          />
                          <label 
                            htmlFor={`recipient-${user.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <span className="font-medium">
                              {user.first_name} {user.last_name}
                            </span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({user.email})
                            </span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {user.role}
                            </Badge>
                          </label>
                        </div>
                      ))}
                      {users.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          Žádní uživatelé k výběru
                        </p>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {reminderRecipients.delivery_mode === "bcc" && (
                <div className="p-3 bg-muted/50 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    V režimu BCC nebudou příjemci vidět ostatní příjemce emailu.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Frequency Card */}
          {/* No recipients warning */}
          {reminderRecipients.user_ids.length === 0 && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Nejsou vybráni příjemci</p>
                    <p className="text-sm text-muted-foreground">
                      Připomínky nebudou odesílány, dokud nevyberete alespoň jednoho příjemce v sekci výše.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Frequency Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Frekvence odesílání
              </CardTitle>
              <CardDescription>
                Nastavte, jak často se mají odesílat souhrnné emaily
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Povolit odesílání připomínek</Label>
                  <p className="text-sm text-muted-foreground">
                    Dočasně pozastavit odesílání bez změny cron konfigurace
                  </p>
                </div>
                <Switch
                  checked={reminderFrequency.enabled}
                  onCheckedChange={(checked) => 
                    setReminderFrequency({ ...reminderFrequency, enabled: checked })
                  }
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frekvence</Label>
                  <Select
                    value={reminderFrequency.type}
                    onValueChange={handleFrequencyPresetChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {reminderFrequency.type === "custom" && (
                  <div className="space-y-2">
                    <Label>Interval (dny)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={reminderFrequency.interval_days}
                      onChange={(e) => 
                        setReminderFrequency({ 
                          ...reminderFrequency, 
                          interval_days: parseInt(e.target.value) || 7 
                        })
                      }
                    />
                  </div>
                )}

                {reminderFrequency.type !== "custom" && (
                  <div className="space-y-2">
                    <Label>Den v týdnu</Label>
                    <Select
                      value={String(reminderSchedule.day_of_week)}
                      onValueChange={(value) => 
                        setReminderSchedule({ ...reminderSchedule, day_of_week: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day.value} value={String(day.value)}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Čas odeslání</Label>
                  <Input
                    type="time"
                    value={reminderFrequency.start_time}
                    onChange={(e) => 
                      setReminderFrequency({ ...reminderFrequency, start_time: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Časové pásmo</Label>
                  <Select
                    value={reminderFrequency.timezone}
                    onValueChange={(value) => 
                      setReminderFrequency({ ...reminderFrequency, timezone: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Přeskočit víkendy</Label>
                  <p className="text-sm text-muted-foreground">
                    Neodesílat emaily o víkendech
                  </p>
                </div>
                <Switch
                  checked={reminderSchedule.skip_weekends}
                  onCheckedChange={(checked) => 
                    setReminderSchedule({ ...reminderSchedule, skip_weekends: checked })
                  }
                />
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Tip:</strong> Pro on-prem instalace použijte externí cron job, který spustí endpoint 
                  <code className="mx-1 px-1 bg-background rounded">/functions/v1/run-reminders</code>
                  s hlavičkou <code className="mx-1 px-1 bg-background rounded">X-CRON-SECRET</code>.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Days before expiration Card */}
          <Card>
            <CardHeader>
              <CardTitle>Dny před vypršením</CardTitle>
              <CardDescription>
                Školení s expirací v těchto dnech budou zahrnuta v souhrnném emailu
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {reminderDays.days_before.map((day) => (
                  <Badge key={day} variant="secondary" className="text-sm py-1 px-3">
                    {day} dní
                    <button
                      onClick={() => handleRemoveDayBefore(day)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  placeholder="Počet dní"
                  value={newDayBefore}
                  onChange={(e) => setNewDayBefore(e.target.value)}
                  className="w-32"
                />
                <Button variant="outline" onClick={handleAddDayBefore}>
                  <Plus className="w-4 h-4 mr-2" />
                  Přidat
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Test & History Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Testování a historie
              </CardTitle>
              <CardDescription>
                Odešlete testovací email nebo zobrazte historii odeslaných emailů
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SendSingleTestEmail isEnabled={reminderFrequency.enabled} />
              <SendTestSummaryEmail 
                hasRecipients={reminderRecipients.user_ids.length > 0}
                isEnabled={reminderFrequency.enabled}
              />
              <EmailHistory />
            </CardContent>
          </Card>

          {/* Next Scheduled Send Preview */}
          <NextSendPreview 
            schedule={reminderSchedule}
            frequency={reminderFrequency}
            hasRecipients={reminderRecipients.user_ids.length > 0}
          />
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Poskytovatel emailů</CardTitle>
              <CardDescription>
                Vyberte způsob odesílání emailů
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Poskytovatel</Label>
                <Select
                  value={emailProvider.provider}
                  onValueChange={(value) => 
                    setEmailProvider({ ...emailProvider, provider: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resend">Resend API</SelectItem>
                    <SelectItem value="smtp">SMTP Server</SelectItem>
                    <SelectItem value="smtp_with_resend_fallback">SMTP s fallbackem na Resend</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {emailProvider.provider === "smtp_with_resend_fallback" && 
                    "Použije SMTP jako primární, při selhání automaticky přepne na Resend"}
                </p>
              </div>

              {emailProvider.provider === "resend" && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Resend API</p>
                      <p className="text-sm text-muted-foreground">
                        Pro použití Resend API je nutné nastavit RESEND_API_KEY v proměnných prostředí serveru.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {(emailProvider.provider === "smtp" || emailProvider.provider === "smtp_with_resend_fallback") && (
                <div className="space-y-4">
                  {emailProvider.provider === "smtp_with_resend_fallback" && (
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">SMTP s fallbackem</p>
                          <p className="text-sm text-muted-foreground">
                            Při selhání SMTP se automaticky použije Resend. Vyžaduje nastavení RESEND_API_KEY.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input
                        value={emailProvider.smtp_host}
                        onChange={(e) => 
                          setEmailProvider({ ...emailProvider, smtp_host: e.target.value })
                        }
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Port</Label>
                      <Input
                        type="number"
                        value={emailProvider.smtp_port}
                        onChange={(e) => 
                          setEmailProvider({ ...emailProvider, smtp_port: parseInt(e.target.value) || 587 })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Obvykle 587 (STARTTLS) nebo 465 (SMTPS)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Uživatelské jméno</Label>
                      <Input
                        value={emailProvider.smtp_user}
                        onChange={(e) => 
                          setEmailProvider({ ...emailProvider, smtp_user: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Heslo</Label>
                      <div className="relative">
                        <Input
                          type={showSmtpPassword ? "text" : "password"}
                          placeholder="Nastaveno v ENV: SMTP_PASSWORD"
                          disabled
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Heslo je nastaveno v proměnné SMTP_PASSWORD
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email odesílatele</Label>
                      <Input
                        type="email"
                        value={emailProvider.smtp_from_email}
                        onChange={(e) => 
                          setEmailProvider({ ...emailProvider, smtp_from_email: e.target.value })
                        }
                        placeholder="noreply@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Jméno odesílatele</Label>
                      <Input
                        value={emailProvider.smtp_from_name}
                        onChange={(e) => 
                          setEmailProvider({ ...emailProvider, smtp_from_name: e.target.value })
                        }
                        placeholder="Training System"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <p className="text-sm font-medium">Nastavení TLS</p>
                    
                    <div className="space-y-2">
                      <Label>Režim TLS</Label>
                      <Select
                        value={emailProvider.smtp_tls_mode || "starttls"}
                        onValueChange={(value) => 
                          setEmailProvider({ 
                            ...emailProvider, 
                            smtp_tls_mode: value,
                            smtp_port: value === "smtps" ? 465 : 587
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starttls">STARTTLS (port 587)</SelectItem>
                          <SelectItem value="smtps">SMTPS / Implicit TLS (port 465)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        STARTTLS upgraduje na TLS po připojení, SMTPS používá TLS od začátku
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Zabezpečené připojení (TLS)</Label>
                        <p className="text-sm text-muted-foreground">
                          Použít šifrované připojení k SMTP serveru
                        </p>
                      </div>
                      <Switch
                        checked={emailProvider.smtp_secure}
                        onCheckedChange={(checked) => 
                          setEmailProvider({ ...emailProvider, smtp_secure: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Ignorovat TLS chyby</Label>
                        <p className="text-sm text-muted-foreground">
                          Povolit self-signed certifikáty (pouze pro testování)
                        </p>
                      </div>
                      <Switch
                        checked={emailProvider.smtp_ignore_tls || false}
                        onCheckedChange={(checked) => 
                          setEmailProvider({ ...emailProvider, smtp_ignore_tls: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Šablona souhrnného emailu</CardTitle>
              <CardDescription>
                Upravte text souhrnného emailu odesílaného vybraným příjemcům
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Předmět</Label>
                <Input
                  value={emailTemplate.subject}
                  onChange={(e) => 
                    setEmailTemplate({ ...emailTemplate, subject: e.target.value })
                  }
                  placeholder="Souhrn školení k obnovení - {reportDate}"
                />
              </div>

              <div className="space-y-2">
                <Label>Tělo emailu</Label>
                <Textarea
                  value={emailTemplate.body}
                  onChange={(e) => 
                    setEmailTemplate({ ...emailTemplate, body: e.target.value })
                  }
                  rows={8}
                  placeholder="Dobrý den,\n\nzasíláme přehled školení..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Live Email Preview */}
          <EmailTemplatePreview 
            subject={emailTemplate.subject}
            body={emailTemplate.body}
          />
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="user-management" className="space-y-6">
          <UserManagementPanel />
        </TabsContent>

        {/* Users (Recipients) Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Přehled uživatelů a rolí</CardTitle>
              <CardDescription>
                Přehled všech uživatelů v systému a jejich rolí (pro změnu rolí použijte záložku "Správa uživatelů")
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Uživatel</SelectItem>
                          <SelectItem value="manager">Manažer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  
                  {users.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Žádní uživatelé
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Role Permissions Info */}
          <RolePermissionsInfo />
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import a export dat</CardTitle>
              <CardDescription>
                Hromadný import nebo export dat ze systému
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Export dat</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Stáhněte si CSV soubory s daty ze systému
                  </p>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full" onClick={() => navigate("/other")}>
                      Exportovat zaměstnance
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => navigate("/other")}>
                      Exportovat školení
                    </Button>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Import dat</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Nahrajte CSV soubory pro hromadný import
                  </p>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full" onClick={() => navigate("/other")}>
                      Importovat zaměstnance
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => navigate("/other")}>
                      Importovat školení
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
