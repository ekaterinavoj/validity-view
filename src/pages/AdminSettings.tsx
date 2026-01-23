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
import { Loader2, Settings, Mail, Clock, Users, Database, Save, Plus, X, Eye, EyeOff, AlertCircle } from "lucide-react";

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

const TEMPLATE_VARIABLES = [
  { var: "{firstName}", desc: "Křestní jméno zaměstnance" },
  { var: "{lastName}", desc: "Příjmení zaměstnance" },
  { var: "{trainingName}", desc: "Název školení" },
  { var: "{expiresOn}", desc: "Datum vypršení" },
  { var: "{daysLeft}", desc: "Počet dní do vypršení" },
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
  
  const [emailProvider, setEmailProvider] = useState({
    provider: "resend",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_from_email: "",
    smtp_from_name: "Training System",
    smtp_secure: true,
  });
  
  const [emailTemplate, setEmailTemplate] = useState({
    subject: "",
    body: "",
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
      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name");
      
      if (profilesError) throw profilesError;
      
      // Get roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      
      if (rolesError) throw rolesError;
      
      // Combine data
      const usersWithRoles = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          role: userRole?.role || "user",
          is_active: true, // TODO: Add is_active field to profiles if needed
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
    const { error } = await supabase
      .from("system_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);
    
    if (error) throw error;
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting("reminder_schedule", reminderSchedule),
        saveSetting("reminder_days", reminderDays),
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

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      // First delete existing role
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      
      // Then insert new role
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

      <Tabs defaultValue="reminders" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Připomínky
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Emaily
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Uživatelé
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Data
          </TabsTrigger>
        </TabsList>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Plán připomínek</CardTitle>
              <CardDescription>
                Nastavte, kdy se mají automaticky odesílat připomínky
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Povolit automatické připomínky</Label>
                  <p className="text-sm text-muted-foreground">
                    Systém bude automaticky odesílat připomínky podle plánu
                  </p>
                </div>
                <Switch
                  checked={reminderSchedule.enabled}
                  onCheckedChange={(checked) => 
                    setReminderSchedule({ ...reminderSchedule, enabled: checked })
                  }
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
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

                <div className="space-y-2">
                  <Label>Čas odeslání</Label>
                  <Input
                    type="time"
                    value={reminderSchedule.time}
                    onChange={(e) => 
                      setReminderSchedule({ ...reminderSchedule, time: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Přeskočit víkendy</Label>
                  <p className="text-sm text-muted-foreground">
                    Neodesílat připomínky o víkendech
                  </p>
                </div>
                <Switch
                  checked={reminderSchedule.skip_weekends}
                  onCheckedChange={(checked) => 
                    setReminderSchedule({ ...reminderSchedule, skip_weekends: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dny před vypršením</CardTitle>
              <CardDescription>
                Kolik dní před vypršením školení odeslat připomínku
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
                  </SelectContent>
                </Select>
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

              {emailProvider.provider === "smtp" && (
                <div className="space-y-4">
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
                          setEmailProvider({ ...emailProvider, smtp_port: parseInt(e.target.value) })
                        }
                      />
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
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Šablona emailu</CardTitle>
              <CardDescription>
                Upravte text připomínkového emailu
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
                  placeholder="Upozornění: Školení {trainingName} brzy vyprší"
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
                  placeholder="Dobrý den {firstName} {lastName}..."
                />
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Dostupné proměnné:</p>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <div key={v.var} className="flex items-center gap-2 text-sm">
                      <code className="bg-background px-2 py-0.5 rounded">{v.var}</code>
                      <span className="text-muted-foreground">- {v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Správa uživatelů</CardTitle>
              <CardDescription>
                Přidělte role uživatelům systému
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