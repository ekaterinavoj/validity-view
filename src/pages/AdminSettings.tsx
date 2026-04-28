import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Loader2, Settings, Mail, Clock, Users, Save, Plus, X, Eye, EyeOff, AlertCircle, UserCheck, Calendar, Shield, History, UserPlus, Palette, GraduationCap, Wrench, Stethoscope } from "lucide-react";
import { ReminderTemplates } from "@/components/ReminderTemplates";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { FileText } from "lucide-react";
import { ReminderSimulationPreview } from "@/components/ReminderSimulationPreview";
import { ReminderLogs } from "@/components/ReminderLogs";
import { SendTestSummaryEmail } from "@/components/SendTestSummaryEmail";
import { SendTestDeadlineEmail } from "@/components/SendTestDeadlineEmail";
import { SendTestMedicalEmail } from "@/components/SendTestMedicalEmail";
import { SendSingleTestEmail } from "@/components/SendSingleTestEmail";
import { SendTestSmtpEmail } from "@/components/SendTestSmtpEmail";
import { EmailHistory } from "@/components/EmailHistory";
import { EmailTemplatePreview } from "@/components/EmailTemplatePreview";
import { DeadlineEmailTemplatePreview } from "@/components/DeadlineEmailTemplatePreview";


import { UserManagementPanel } from "@/components/UserManagementPanel";
import { OnboardingSettings } from "@/components/OnboardingSettings";
import { EmployeeAccessDebug } from "@/components/EmployeeAccessDebug";
import { MedicalDocsAccessDebug } from "@/components/MedicalDocsAccessDebug";
import { MigrationsStatus } from "@/components/MigrationsStatus";
import { SecurityFindings } from "@/components/SecurityFindings";
import { SecurityAuditPanel } from "@/components/SecurityAuditPanel";
import { LockoutMonitorPanel } from "@/components/LockoutMonitorPanel";
import { SecurityScanRunner } from "@/components/SecurityScanRunner";
import { SessionTimeoutSettings } from "@/components/SessionTimeoutSettings";
import { PasswordPolicySettings } from "@/components/PasswordPolicySettings";
import { ShieldAlert } from "lucide-react";

import { DisplaySettings } from "@/components/DisplaySettings";
import { ModuleRecipientsSelector } from "@/components/ModuleRecipientsSelector";
import { ModuleReminderSettings } from "@/components/ModuleReminderSettings";

interface SystemSetting {
  id: string;
  key: string;
  value: any;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface UserWithRole {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
}


export default function AdminSettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  
  // Get initial tab from URL query param, default to "onboarding"
  const tabParam = searchParams.get("tab");
  const validTabs = ["onboarding", "user-management", "reminders", "email", "history", "audit-log", "security"];
  // Backward compat: starý tab "diagnostics" byl sloučen do "audit-log"
  const normalizedTabParam = tabParam === "diagnostics" ? "audit-log" : tabParam;
  const initialTab = normalizedTabParam && validTabs.includes(normalizedTabParam) ? normalizedTabParam : "onboarding";
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showAccessDebug, setShowAccessDebug] = useState<boolean>(() => {
    return localStorage.getItem("admin-show-access-debug") === "1";
  });
  useEffect(() => {
    localStorage.setItem("admin-show-access-debug", showAccessDebug ? "1" : "0");
  }, [showAccessDebug]);
  
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
    enabled: true,
  });
  
  const [reminderRecipients, setReminderRecipients] = useState({
    user_ids: [] as string[],
    delivery_mode: "bcc" as string,
  });
  
  const [emailProvider, setEmailProvider] = useState({
    provider: "smtp",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    smtp_auth_enabled: true,
    smtp_auth_type: "basic" as string, // "basic" | "oauth2_m365" | "oauth2_gmail"
    smtp_from_email: "",
    smtp_from_name: "Training System",
    smtp_secure: true,
    smtp_tls_mode: "starttls",
    smtp_ignore_tls: false,
    smtp_starttls_fallback_allowed: false,
    // M365 OAuth2
    smtp_oauth_tenant_id: "",
    smtp_oauth_client_id: "",
    smtp_oauth_client_secret: "",
    // Gmail OAuth2
    smtp_gmail_client_id: "",
    smtp_gmail_client_secret: "",
    smtp_gmail_refresh_token: "",
  });
  
  const [emailTemplate, setEmailTemplate] = useState({
    subject: "Souhrn školení k obnovení - {reportDate}",
    body: "Dobrý den,\n\nzasíláme přehled školení vyžadujících pozornost.\n\nCelkem: {totalCount} školení\n- Brzy vypršuje: {expiringCount}\n- Prošlé: {expiredCount}\n\nPodrobný seznam naleznete v příloze níže.\n\nS pozdravem,\nVáš systém školení",
  });
  
  const [deadlineEmailTemplate, setDeadlineEmailTemplate] = useState({
    subject: "Souhrn technických lhůt k obnovení - {reportDate}",
    body: "Dobrý den,\n\nzasíláme přehled technických lhůt vyžadujících pozornost.\n\nCelkem: {totalCount} událostí\n- Brzy vypršuje: {expiringCount}\n- Prošlé: {expiredCount}\n\nPodrobný seznam naleznete v příloze níže.\n\nS pozdravem,\nVáš systém technických lhůt",
  });

  const [medicalEmailTemplate, setMedicalEmailTemplate] = useState({
    subject: "Souhrn lékařských prohlídek k obnovení - {reportDate}",
    body: "Dobrý den,\n\nzasíláme přehled pracovně lékařských prohlídek vyžadujících pozornost.\n\nCelkem: {totalCount} prohlídek\n- Brzy vypršuje: {expiringCount}\n- Prošlé: {expiredCount}\n\nPodrobný seznam naleznete v příloze níže.\n\nS pozdravem,\nVáš systém pracovně lékařských prohlídek",
  });
  
  // Recipients state per module
  const [deadlineRecipients, setDeadlineRecipients] = useState({
    user_ids: [] as string[],
    delivery_mode: "bcc" as string,
  });

  const [medicalRecipients, setMedicalRecipients] = useState({
    user_ids: [] as string[],
    delivery_mode: "bcc" as string,
  });

  // Deadline-specific frequency (independent from training)
  const [deadlineReminderFrequency, setDeadlineReminderFrequency] = useState({
    type: "weekly" as string,
    interval_days: 7,
    start_time: "08:00",
    timezone: "Europe/Prague",
    enabled: true,
  });

  const [deadlineReminderSchedule, setDeadlineReminderSchedule] = useState({
    enabled: true,
    day_of_week: 1,
    time: "08:00",
    skip_weekends: true,
  });

  // PLP-specific frequency (independent)
  const [medicalReminderFrequency, setMedicalReminderFrequency] = useState({
    enabled: true,
    skip_weekends: true,
  });
  
  const [newDayBefore, setNewDayBefore] = useState("");
  
  // Users state
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Sync tab with URL params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

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
            if (setting.value && typeof setting.value === 'object') {
              setReminderSchedule(prev => ({ ...prev, ...(setting.value as object) }));
            }
            break;
          case "reminder_days":
            if (setting.value && typeof setting.value === 'object') {
              setReminderDays(prev => ({ ...prev, ...(setting.value as object) }));
            }
            break;
          case "reminder_frequency":
            if (setting.value && typeof setting.value === 'object') {
              setReminderFrequency(prev => ({ ...prev, ...(setting.value as object) }));
            }
            break;
          case "reminder_recipients":
            if (setting.value && typeof setting.value === 'object') {
              setReminderRecipients(prev => ({ ...prev, ...(setting.value as object) }));
            }
            break;
          case "deadline_reminder_recipients":
            if (setting.value && typeof setting.value === 'object') {
              setDeadlineRecipients(prev => ({ ...prev, ...(setting.value as object) }));
            }
            break;
          case "email_provider":
            if (setting.value && typeof setting.value === 'object') {
              setEmailProvider(setting.value as typeof emailProvider);
            }
            break;
          case "email_template":
            if (setting.value && typeof setting.value === 'object') {
              setEmailTemplate(prev => ({ ...prev, ...(setting.value as object) }));
            }
            break;
          case "deadline_email_template":
            if (setting.value && typeof setting.value === 'object') {
              setDeadlineEmailTemplate(prev => ({ ...prev, ...(setting.value as object) }));
            }
            break;
          case "medical_email_template":
            if (setting.value && typeof setting.value === 'object') {
              setMedicalEmailTemplate(prev => ({ ...prev, ...(setting.value as object) }));
            }
            break;
          case "medical_reminder_recipients":
            if (setting.value && typeof setting.value === 'object') {
              setMedicalRecipients(prev => ({ ...prev, ...(setting.value as object) }));
            }
            break;
          case "deadline_reminder_frequency":
            if (setting.value && typeof setting.value === 'object') {
              setDeadlineReminderFrequency(prev => ({ ...prev, ...(setting.value as object) }));
            }
            break;
          case "deadline_reminder_schedule":
            if (setting.value && typeof setting.value === 'object') {
              setDeadlineReminderSchedule(prev => ({ ...prev, ...(setting.value as object) }));
            }
            break;
          case "medical_reminder_frequency":
            if (setting.value && typeof setting.value === 'object') {
              setMedicalReminderFrequency(prev => ({ ...prev, ...(setting.value as object) }));
            }
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
        saveSetting("deadline_reminder_recipients", deadlineRecipients),
        saveSetting("deadline_reminder_frequency", deadlineReminderFrequency),
        saveSetting("deadline_reminder_schedule", deadlineReminderSchedule),
        saveSetting("medical_reminder_recipients", medicalRecipients),
        saveSetting("medical_reminder_frequency", medicalReminderFrequency),
        saveSetting("email_provider", emailProvider),
        saveSetting("email_template", emailTemplate),
        saveSetting("deadline_email_template", deadlineEmailTemplate),
        saveSetting("medical_email_template", medicalEmailTemplate),
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="onboarding" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Onboarding
          </TabsTrigger>
          <TabsTrigger value="user-management" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Uživatelé
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Připomínky
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Emaily & Šablony
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Historie
          </TabsTrigger>
          <TabsTrigger value="audit-log" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Audit log
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="space-y-6">
          <OnboardingSettings />
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-6">
          {/* Module-specific Recipients Selector */}
          <ModuleRecipientsSelector 
            onTrainingRecipientsChange={(r) => setReminderRecipients(r)}
            onDeadlineRecipientsChange={(r) => setDeadlineRecipients(r)}
          />

          {/* Per-module per-record alert defaults */}
          <ModuleReminderSettings />

          {/*
            Souhrnné (weekly) připomínky a UI pro frekvence/dny před vypršením byly odstraněny.
            Aplikace používá pouze per-záznam připomínky (viz ModuleReminderSettings výše).
            Edge funkce run-reminders / run-deadline-reminders / run-medical-reminders
            zůstávají v kódu pro historickou kompatibilitu, ale jejich UI a cron jsou vypnuté.
          */}

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
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Školení (per-záznam test)</Label>
                <div className="flex gap-2">
                  <SendSingleTestEmail isEnabled={reminderFrequency.enabled} />
                </div>
              </div>
               <Separator />
               <EmailHistory />
            </CardContent>
          </Card>

        </TabsContent>


        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SMTP Server</CardTitle>
              <CardDescription>
                Nastavení SMTP serveru pro odesílání emailových připomínek
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SMTP Host *</Label>
                  <Input
                    value={emailProvider.smtp_host}
                    onChange={(e) => 
                      setEmailProvider({ ...emailProvider, smtp_host: e.target.value })
                    }
                    placeholder="smtp.example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Adresa SMTP serveru (např. smtp.gmail.com, smtp.office365.com)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port *</Label>
                  <Input
                    type="number"
                    value={emailProvider.smtp_port}
                    onChange={(e) => 
                      setEmailProvider({ ...emailProvider, smtp_port: parseInt(e.target.value) || 587 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Obvykle 587 (STARTTLS) nebo 465 (SMTPS) nebo 25 (bez šifrování)
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Autorizace</Label>
                  <p className="text-sm text-muted-foreground">
                    Vyžaduje server přihlášení? Některé interní SMTP servery fungují bez autorizace.
                  </p>
                </div>
                <Switch
                  checked={emailProvider.smtp_auth_enabled !== false}
                  onCheckedChange={(checked) => 
                    setEmailProvider({ ...emailProvider, smtp_auth_enabled: checked })
                  }
                />
              </div>

              {emailProvider.smtp_auth_enabled !== false && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Typ autorizace</Label>
                    <Select
                      value={emailProvider.smtp_auth_type || "basic"}
                      onValueChange={(value) => {
                        const updates: any = { ...emailProvider, smtp_auth_type: value };
                        // Pre-fill SMTP settings based on provider
                        if (value === "oauth2_m365") {
                          updates.smtp_host = updates.smtp_host || "smtp.office365.com";
                          updates.smtp_port = 587;
                          updates.smtp_tls_mode = "starttls";
                        } else if (value === "oauth2_gmail") {
                          updates.smtp_host = "smtp.gmail.com";
                          updates.smtp_port = 587;
                          updates.smtp_tls_mode = "starttls";
                        }
                        setEmailProvider(updates);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Základní (LOGIN / PLAIN)</SelectItem>
                        <SelectItem value="oauth2_m365">Microsoft 365 OAuth2</SelectItem>
                        <SelectItem value="oauth2_gmail">Gmail / Google Workspace OAuth2</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {emailProvider.smtp_auth_type === "oauth2_m365" 
                        ? "OAuth2 client credentials s XOAUTH2 pro Microsoft 365 / Exchange Online"
                        : emailProvider.smtp_auth_type === "oauth2_gmail"
                        ? "OAuth2 s refresh tokenem a XOAUTH2 pro Gmail / Google Workspace"
                        : "Klasické přihlášení uživatelským jménem a heslem"}
                    </p>
                  </div>

                  {emailProvider.smtp_auth_type === "oauth2_m365" ? (
                    <div className="space-y-4">
                      <div className="p-3 rounded-lg bg-muted text-sm">
                        <p className="font-medium mb-1">📋 Postup nastavení M365 OAuth2:</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>V Azure Portal → App registrations vytvořte novou aplikaci</li>
                          <li>Přidejte API permission: <code className="text-xs bg-background px-1 rounded">Mail.Send</code> (Application)</li>
                          <li>Vytvořte Client secret a zkopírujte hodnoty níže</li>
                          <li>Email odesílatele musí odpovídat licencované M365 schránce</li>
                        </ol>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label>Tenant ID *</Label>
                          <Input
                            value={emailProvider.smtp_oauth_tenant_id || ""}
                            onChange={(e) => 
                              setEmailProvider({ ...emailProvider, smtp_oauth_tenant_id: e.target.value })
                            }
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          />
                          <p className="text-xs text-muted-foreground">
                            ID vašeho Azure AD tenanta (najdete v Azure Portal → Azure Active Directory → Overview)
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Client ID (Application ID) *</Label>
                          <Input
                            value={emailProvider.smtp_oauth_client_id || ""}
                            onChange={(e) => 
                              setEmailProvider({ ...emailProvider, smtp_oauth_client_id: e.target.value })
                            }
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Client Secret *</Label>
                          <div className="relative">
                            <Input
                              type={showSmtpPassword ? "text" : "password"}
                              value={emailProvider.smtp_oauth_client_secret || ""}
                              onChange={(e) => 
                                setEmailProvider({ ...emailProvider, smtp_oauth_client_secret: e.target.value })
                              }
                              placeholder="••••••••"
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
                            Tajný klíč aplikace (Certificates & secrets → New client secret)
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : emailProvider.smtp_auth_type === "oauth2_gmail" ? (
                    <div className="space-y-4">
                      <div className="p-3 rounded-lg bg-muted text-sm">
                        <p className="font-medium mb-1">📋 Postup nastavení Gmail OAuth2:</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>V <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a> vytvořte projekt a aktivujte Gmail API</li>
                          <li>Vytvořte OAuth 2.0 Client ID (typ: Web application)</li>
                          <li>Nastavte Authorized redirect URI (např. <code className="text-xs bg-background px-1 rounded">https://developers.google.com/oauthplayground</code>)</li>
                          <li>V <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" className="underline">OAuth 2.0 Playground</a> vygenerujte refresh token se scope <code className="text-xs bg-background px-1 rounded">https://mail.google.com/</code></li>
                          <li>Email odesílatele musí odpovídat Gmail / Google Workspace účtu</li>
                        </ol>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label>Client ID *</Label>
                          <Input
                            value={emailProvider.smtp_gmail_client_id || ""}
                            onChange={(e) => 
                              setEmailProvider({ ...emailProvider, smtp_gmail_client_id: e.target.value })
                            }
                            placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                          />
                          <p className="text-xs text-muted-foreground">
                            OAuth 2.0 Client ID z Google Cloud Console → Credentials
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Client Secret *</Label>
                          <div className="relative">
                            <Input
                              type={showSmtpPassword ? "text" : "password"}
                              value={emailProvider.smtp_gmail_client_secret || ""}
                              onChange={(e) => 
                                setEmailProvider({ ...emailProvider, smtp_gmail_client_secret: e.target.value })
                              }
                              placeholder="••••••••"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            >
                              {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Refresh Token *</Label>
                          <div className="relative">
                            <Input
                              type={showSmtpPassword ? "text" : "password"}
                              value={emailProvider.smtp_gmail_refresh_token || ""}
                              onChange={(e) => 
                                setEmailProvider({ ...emailProvider, smtp_gmail_refresh_token: e.target.value })
                              }
                              placeholder="1//xxxxxxxxxxxxxxxxx"
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
                            Refresh token vygenerovaný přes OAuth 2.0 Playground nebo vlastní OAuth flow
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Uživatelské jméno</Label>
                        <Input
                          value={emailProvider.smtp_user}
                          onChange={(e) => 
                            setEmailProvider({ ...emailProvider, smtp_user: e.target.value })
                          }
                          placeholder="user@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Heslo</Label>
                        <div className="relative">
                          <Input
                            type={showSmtpPassword ? "text" : "password"}
                            value={emailProvider.smtp_password || ""}
                            onChange={(e) => 
                              setEmailProvider({ ...emailProvider, smtp_password: e.target.value })
                            }
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          >
                            {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email odesílatele (From) *</Label>
                  <Input
                    type="email"
                    value={emailProvider.smtp_from_email}
                    onChange={(e) => 
                      setEmailProvider({ ...emailProvider, smtp_from_email: e.target.value })
                    }
                    placeholder="noreply@vase-firma.cz"
                  />
                  <p className="text-xs text-muted-foreground">
                    Adresa, ze které budou emaily odesílány
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Jméno odesílatele</Label>
                  <Input
                    value={emailProvider.smtp_from_name}
                    onChange={(e) => 
                      setEmailProvider({ ...emailProvider, smtp_from_name: e.target.value })
                    }
                    placeholder="Systém školení"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <p className="text-sm font-medium">Zabezpečení připojení</p>
                
                <div className="space-y-2">
                  <Label>Režim zabezpečení</Label>
                  <Select
                    value={emailProvider.smtp_tls_mode || "starttls"}
                    onValueChange={(value) => {
                      let port = emailProvider.smtp_port;
                      if (value === "smtps") port = 465;
                      else if (value === "starttls") port = 587;
                      else if (value === "none") port = 25;
                      
                      setEmailProvider({ 
                        ...emailProvider, 
                        smtp_tls_mode: value,
                        smtp_port: port,
                        smtp_secure: value !== "none"
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starttls">STARTTLS (port 587)</SelectItem>
                      <SelectItem value="smtps">SMTPS / Implicit TLS (port 465)</SelectItem>
                      <SelectItem value="none">Bez šifrování (port 25)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    STARTTLS upgraduje na TLS po připojení, SMTPS používá TLS od začátku, Bez šifrování pouze pro interní servery
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Ignorovat chyby TLS certifikátu</Label>
                    <p className="text-sm text-muted-foreground">
                      Povolit pouze pro testování nebo interní servery s self-signed certifikáty
                    </p>
                  </div>
                  <Switch
                    checked={emailProvider.smtp_ignore_tls}
                    onCheckedChange={(checked) => 
                      setEmailProvider({ ...emailProvider, smtp_ignore_tls: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-destructive">Povolit nešifrovaný fallback při selhání STARTTLS</Label>
                    <p className="text-sm text-muted-foreground">
                      ⚠️ Nedoporučeno pro produkci — pokud STARTTLS selže, email se odešle nešifrovaně (včetně přihlašovacích údajů)
                    </p>
                  </div>
                  <Switch
                    checked={emailProvider.smtp_starttls_fallback_allowed || false}
                    onCheckedChange={(checked) => 
                      setEmailProvider({ ...emailProvider, smtp_starttls_fallback_allowed: checked })
                    }
                  />
                </div>
              </div>

              {/* Status indicator */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-start gap-3">
                {emailProvider.smtp_host && emailProvider.smtp_from_email ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">SMTP nakonfigurováno</p>
                        <p className="text-sm text-muted-foreground">
                          Server: {emailProvider.smtp_host}:{emailProvider.smtp_port} | 
                          Odesílatel: {emailProvider.smtp_from_email} | 
                          {emailProvider.smtp_auth_enabled !== false 
                            ? (emailProvider.smtp_auth_type === "oauth2_m365" ? " M365 OAuth2" : emailProvider.smtp_auth_type === "oauth2_gmail" ? " Gmail OAuth2" : " Základní autorizace") 
                            : " Bez autorizace"}
                        </p>
                      </div>
                      <SendTestSmtpEmail 
                        smtpHost={emailProvider.smtp_host}
                        smtpPort={emailProvider.smtp_port}
                        smtpFromEmail={emailProvider.smtp_from_email}
                        smtpAuthEnabled={emailProvider.smtp_auth_enabled !== false}
                      />
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">SMTP není nakonfigurováno</p>
                        <p className="text-sm text-muted-foreground">
                          Pro odesílání emailů vyplňte SMTP host a email odesílatele
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Email Templates with Tabs for both modules – skryto, souhrny vypnuty */}
          {false && (
          <Card>
            <CardHeader>
              <CardTitle>Souhrnné emaily podle modulu</CardTitle>
              <CardDescription>
                Upravte text a předmět periodických souhrnných přehledů. Individuální emaily (per-záznam) se řídí šablonami níže.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="training" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="training" className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Školení
                  </TabsTrigger>
                  <TabsTrigger value="deadlines" className="flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Technické lhůty
                  </TabsTrigger>
                  <TabsTrigger value="medical" className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" />
                    PLP
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="training" className="space-y-4 pt-4">
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

                  <EmailTemplatePreview 
                    subject={emailTemplate.subject}
                    body={emailTemplate.body}
                  />
                </TabsContent>

                <TabsContent value="deadlines" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Předmět</Label>
                    <Input
                      value={deadlineEmailTemplate.subject}
                      onChange={(e) => 
                        setDeadlineEmailTemplate({ ...deadlineEmailTemplate, subject: e.target.value })
                      }
                      placeholder="Souhrn technických lhůt k obnovení - {reportDate}"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tělo emailu</Label>
                    <Textarea
                      value={deadlineEmailTemplate.body}
                      onChange={(e) => 
                        setDeadlineEmailTemplate({ ...deadlineEmailTemplate, body: e.target.value })
                      }
                      rows={8}
                      placeholder="Dobrý den,\n\nzasíláme přehled technických lhůt..."
                    />
                  </div>

                  <DeadlineEmailTemplatePreview 
                    subject={deadlineEmailTemplate.subject}
                    body={deadlineEmailTemplate.body}
                  />
                </TabsContent>

                <TabsContent value="medical" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Předmět</Label>
                    <Input
                      value={medicalEmailTemplate.subject}
                      onChange={(e) => 
                        setMedicalEmailTemplate({ ...medicalEmailTemplate, subject: e.target.value })
                      }
                      placeholder="Souhrn lékařských prohlídek k obnovení - {reportDate}"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tělo emailu</Label>
                    <Textarea
                      value={medicalEmailTemplate.body}
                      onChange={(e) => 
                        setMedicalEmailTemplate({ ...medicalEmailTemplate, body: e.target.value })
                      }
                      rows={8}
                      placeholder="Dobrý den,\n\nzasíláme přehled lékařských prohlídek..."
                    />
                  </div>

                  {/* Medical Email Template Preview */}
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4" />
                      <span className="text-sm font-medium">Náhled emailu (živý)</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline" className="text-xs">
                        {"{totalCount}"} → Celkový počet prohlídek
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {"{expiringCount}"} → Počet brzy vypršujících
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {"{expiredCount}"} → Počet prošlých
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {"{reportDate}"} → Datum reportu
                      </Badge>
                    </div>
                    
                    <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Ukázková data: 8 prohlídek (3 prošlé, 5 brzy vyprší)
                    </div>
                    
                    <div className="border rounded bg-background p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <strong>Předmět:</strong> 
                        {medicalEmailTemplate.subject
                          .replace(/\{totalCount\}/g, "8")
                          .replace(/\{expiringCount\}/g, "5")
                          .replace(/\{expiredCount\}/g, "3")
                          .replace(/\{reportDate\}/g, new Date().toLocaleDateString("cs-CZ"))}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <strong>Datum:</strong> {new Date().toLocaleDateString("cs-CZ")}
                      </div>
                      <Separator className="my-2" />
                      <div className="whitespace-pre-wrap text-sm">
                        {medicalEmailTemplate.body
                          .replace(/\{totalCount\}/g, "8")
                          .replace(/\{expiringCount\}/g, "5")
                          .replace(/\{expiredCount\}/g, "3")
                          .replace(/\{reportDate\}/g, new Date().toLocaleDateString("cs-CZ"))}
                      </div>
                    </div>
                  </div>
                  
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          )}

          {/* Šablony individuálních připomínek */}
          <Separator />
          <ReminderSimulationPreview />
          <ReminderTemplates />
        </TabsContent>

        {/* User Management Tab */}
        <TabsContent value="user-management" className="space-y-6">
          <UserManagementPanel />
        </TabsContent>


        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <ReminderLogs />
        </TabsContent>

        {/* Audit log Tab — sloučeno: jednoduchý log + pokročilý filtr + RLS diagnostika */}
        <TabsContent value="audit-log" className="space-y-6">
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList>
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Přehled změn
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Pokročilý filtr
              </TabsTrigger>
              <TabsTrigger value="rls" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Diagnostika RLS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6">
              <AuditLogPanel />
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
              <SecurityAuditPanel />
            </TabsContent>

            <TabsContent value="rls" className="space-y-6">
              <Card className="border-primary/40 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    Diagnostika přístupových oprávnění (RLS)
                  </CardTitle>
                  <CardDescription>
                    Vývojářské nástroje pro ověření, zda RLS politiky správně omezují viditelnost dat.
                    Defaultně skryto kvůli přehlednosti.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label htmlFor="show-debug" className="font-medium">Zobrazit debug panely přístupů</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Zaměstnanci a lékařské dokumenty – kdo na co vidí.
                      </p>
                    </div>
                    <Switch
                      id="show-debug"
                      checked={showAccessDebug}
                      onCheckedChange={setShowAccessDebug}
                    />
                  </div>
                </CardContent>
              </Card>
              {showAccessDebug && (
                <>
                  <EmployeeAccessDebug />
                  <MedicalDocsAccessDebug />
                </>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <SessionTimeoutSettings />
          <PasswordPolicySettings />
          <LockoutPolicySettings />
          <LockoutMonitorPanel />
          <SecurityScanRunner />
          <SecurityFindings />
          <MigrationsStatus />
        </TabsContent>

      </Tabs>
    </div>
  );
}
