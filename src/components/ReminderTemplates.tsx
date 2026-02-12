import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, Save, X, Bell, Play, Loader2, GraduationCap, Wrench, Stethoscope } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDaysBeforeExpiry, formatDays } from "@/lib/czechGrammar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReminderTemplate {
  id: string;
  name: string;
  description?: string;
  remind_days_before: number;
  repeat_interval_days?: number;
  email_subject: string;
  email_body: string;
  is_active: boolean;
  created_at: string;
}

type ModuleType = "trainings" | "deadlines" | "medical";

export const ReminderTemplates = () => {
  const { toast } = useToast();
  const [activeModule, setActiveModule] = useState<ModuleType>("trainings");
  const [trainingTemplates, setTrainingTemplates] = useState<ReminderTemplate[]>([]);
  const [deadlineTemplates, setDeadlineTemplates] = useState<ReminderTemplate[]>([]);
  const [medicalTemplates, setMedicalTemplates] = useState<ReminderTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    remind_days_before: 30,
    repeat_interval_days: 0,
    email_subject: "",
    email_body: "",
    is_active: true,
  });

  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);
  const [checkResult, setCheckResult] = useState<{ total_emails_sent: number; results: any[]; info?: string; message?: string } | null>(null);

  // Current templates based on active module
  const templates = activeModule === "trainings" 
    ? trainingTemplates 
    : activeModule === "deadlines" 
      ? deadlineTemplates 
      : medicalTemplates;
  const tableName = activeModule === "trainings" 
    ? "reminder_templates" 
    : activeModule === "deadlines" 
      ? "deadline_reminder_templates" 
      : "medical_reminder_templates";

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      // Load training templates
      const { data: trainingData, error: trainingError } = await supabase
        .from("reminder_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (trainingError) throw trainingError;
      setTrainingTemplates(trainingData || []);

      // Load deadline templates
      const { data: deadlineData, error: deadlineError } = await supabase
        .from("deadline_reminder_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (deadlineError) throw deadlineError;
      setDeadlineTemplates(deadlineData || []);

      // Load medical templates
      const { data: medicalData, error: medicalError } = await supabase
        .from("medical_reminder_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (medicalError) throw medicalError;
      setMedicalTemplates(medicalData || []);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání šablon",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreate = () => {
    setFormData({
      name: "",
      description: "",
      remind_days_before: 30,
      repeat_interval_days: 0,
      email_subject: "",
      email_body: "",
      is_active: true,
    });
    setCreateDialogOpen(true);
  };

  const handleEdit = (template: ReminderTemplate) => {
    setFormData({
      name: template.name,
      description: template.description || "",
      remind_days_before: template.remind_days_before,
      repeat_interval_days: template.repeat_interval_days || 0,
      email_subject: template.email_subject,
      email_body: template.email_body,
      is_active: template.is_active,
    });
    setEditingTemplate(template);
    setCreateDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email_subject || !formData.email_body) {
      toast({
        title: "Chybí povinné údaje",
        description: "Vyplňte prosím název, předmět a text emailu.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const templateData = {
        name: formData.name,
        description: formData.description,
        remind_days_before: formData.remind_days_before,
        repeat_interval_days: formData.repeat_interval_days || null,
        email_subject: formData.email_subject,
        email_body: formData.email_body,
        is_active: formData.is_active,
      };

      if (editingTemplate) {
        // Aktualizace existující šablony
        const { error } = await supabase
          .from(tableName)
          .update(templateData)
          .eq("id", editingTemplate.id);

        if (error) throw error;

        toast({
          title: "Šablona aktualizována",
          description: "Šablona připomínky byla úspěšně aktualizována.",
        });
      } else {
        // Vytvoření nové šablony
        const { error } = await supabase
          .from(tableName)
          .insert([templateData]);

        if (error) throw error;

        toast({
          title: "Šablona vytvořena",
          description: "Nová šablona připomínky byla úspěšně vytvořena.",
        });
      }

      setCreateDialogOpen(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (error: any) {
      toast({
        title: "Chyba při ukládání",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Šablona smazána",
        description: "Šablona připomínky byla úspěšně odstraněna.",
      });

      setDeleteDialogOpen(null);
      loadTemplates();
    } catch (error: any) {
      toast({
        title: "Chyba při mazání",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (template: ReminderTemplate) => {
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ is_active: !template.is_active })
        .eq("id", template.id);

      if (error) throw error;

      toast({
        title: template.is_active ? "Šablona deaktivována" : "Šablona aktivována",
      });

      loadTemplates();
    } catch (error: any) {
      toast({
        title: "Chyba při změně stavu",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getPreviewEmail = () => {
    // Use different placeholders based on module
    if (activeModule === "trainings") {
      const subject = formData.email_subject
        .replace(/\{\{training_name\}\}/g, "Bezpečnost práce")
        .replace(/\{\{days_remaining\}\}/g, "15");
      
      const body = formData.email_body
        .replace(/\{\{training_name\}\}/g, "Bezpečnost práce")
        .replace(/\{\{days_remaining\}\}/g, "15");
      
      return { subject, body };
    } else if (activeModule === "deadlines") {
      const subject = formData.email_subject
        .replace(/\{\{equipmentName\}\}/g, "Hasící přístroj A1")
        .replace(/\{\{deadlineType\}\}/g, "Revize")
        .replace(/\{\{daysLeft\}\}/g, "15");
      
      const body = formData.email_body
        .replace(/\{\{equipmentName\}\}/g, "Hasící přístroj A1")
        .replace(/\{\{deadlineType\}\}/g, "Revize")
        .replace(/\{\{daysLeft\}\}/g, "15");
      
      return { subject, body };
    } else {
      const subject = formData.email_subject
        .replace(/\{\{employeeName\}\}/g, "Jan Novák")
        .replace(/\{\{examinationType\}\}/g, "Vstupní prohlídka")
        .replace(/\{\{daysLeft\}\}/g, "15");
      
      const body = formData.email_body
        .replace(/\{\{employeeName\}\}/g, "Jan Novák")
        .replace(/\{\{examinationType\}\}/g, "Vstupní prohlídka")
        .replace(/\{\{daysLeft\}\}/g, "15");
      
      return { subject, body };
    }
  };

  const getModuleLabel = () => {
    switch (activeModule) {
      case "trainings": return "školení";
      case "deadlines": return "technických událostí";
      case "medical": return "lékařských prohlídek";
    }
  };
  const getModuleIcon = () => {
    switch (activeModule) {
      case "trainings": return GraduationCap;
      case "deadlines": return Wrench;
      case "medical": return Stethoscope;
    }
  };

  const handleRunCheck = async () => {
    setRunningCheck(true);
    setCheckResult(null);
    
    try {
      // Call the correct edge function based on module
      const functionName = activeModule === "trainings" 
        ? "run-reminders" 
        : activeModule === "deadlines" 
          ? "run-deadline-reminders" 
          : "run-medical-reminders";
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { triggered_by: "manual" }
      });

      if (error) throw error;

      setCheckResult(data);
      
      // Check if email service is not configured
      if (data.info) {
        toast({
          title: "Email služba není nakonfigurována",
          description: data.info,
          variant: "default",
        });
      } else {
        toast({
          title: "Kontrola dokončena",
          description: `Bylo odesláno ${data.total_emails_sent} připomínek.`,
        });
      }
    } catch (error: any) {
      console.error("Error running check:", error);
      toast({
        title: "Chyba při kontrole připomínek",
        description: error.message || "Nepodařilo se spustit kontrolu připomínek.",
        variant: "destructive",
      });
    } finally {
      setRunningCheck(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Tabs */}
      <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as ModuleType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="trainings" className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            Školení
          </TabsTrigger>
          <TabsTrigger value="deadlines" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Tech. události
          </TabsTrigger>
          <TabsTrigger value="medical" className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            PLP
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Manuální kontrola připomínek */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Manuální kontrola připomínek {getModuleLabel()}
          </CardTitle>
          <CardDescription>
            Spusťte okamžitou kontrolu {getModuleLabel()} a odešlete připomínky bez čekání na automatickou kontrolu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Jak funguje manuální kontrola:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Systém projde všechny aktivní šablony připomínek</li>
                <li>Zkontroluje {getModuleLabel()}, kterým brzy vyprší platnost</li>
                <li>Odešle připomínkové emaily podle nastavených šablon</li>
                <li>Zobrazí výsledek - kolik emailů bylo odesláno</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                <strong>Poznámka:</strong> Pro odeslání emailů musí být nakonfigurován SMTP server v Administraci.
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4">
            <Button 
              onClick={handleRunCheck} 
              disabled={runningCheck}
              size="lg"
              className="w-full md:w-auto"
            >
              {runningCheck ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Kontroluji...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Zkontrolovat nyní
                </>
              )}
            </Button>
          </div>

          {checkResult && (
            <Alert className={`mt-4 ${checkResult.info ? 'border-secondary' : ''}`}>
              <Bell className="h-4 w-4" />
              <AlertDescription>
                {checkResult.info ? (
                  <>
                    <p className="font-semibold text-secondary-foreground">Email služba není nakonfigurována</p>
                    <p className="text-sm mt-1">{checkResult.info}</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">Výsledek kontroly:</p>
                    <p className="text-sm mt-1">
                      Celkem odesláno <strong>{checkResult.total_emails_sent}</strong> připomínek
                    </p>
                    {checkResult.results && checkResult.results.length > 0 && (
                      <div className="mt-3 max-h-40 overflow-y-auto">
                        <p className="text-xs font-semibold mb-1">Detail:</p>
                        <ul className="text-xs space-y-1">
                          {checkResult.results.map((result: any, idx: number) => (
                            <li key={idx} className={result.status === 'sent' ? 'text-primary' : 'text-destructive'}>
                              {result.status === 'sent' ? '✓' : '✗'} {result.template} - {result.recipients || 0} příjemců
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
               <CardTitle className="flex items-center gap-2">
                 <Bell className="w-5 h-5" />
                 Šablony připomínek {getModuleLabel()}
               </CardTitle>
              <CardDescription>
                Vytvořte a spravujte šablony pro automatické připomínky {getModuleLabel()}
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Nová šablona
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {templates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Zatím nejsou vytvořeny žádné šablony připomínek.
              </p>
            ) : (
              templates.map((template) => (
                <Card key={template.id} className="border-l-4 border-l-primary/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{template.name}</h3>
                          {template.is_active ? (
                            <Badge variant="default">Aktivní</Badge>
                          ) : (
                            <Badge variant="secondary">Neaktivní</Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Připomenout:</span>
                            <span className="font-medium">{formatDaysBeforeExpiry(template.remind_days_before)}</span>
                          </div>
                          {template.repeat_interval_days && template.repeat_interval_days > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Opakovat každých:</span>
                              <span className="font-medium">{formatDays(template.repeat_interval_days)}</span>
                            </div>
                          )}
                        </div>
                        <div className="pt-2">
                          <p className="text-xs text-muted-foreground mb-1">Předmět emailu:</p>
                          <p className="text-sm font-medium">{template.email_subject}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={() => handleToggleActive(template)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteDialogOpen(template.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog pro vytvoření/úpravu šablony */}
      <Dialog 
        open={createDialogOpen} 
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setEditingTemplate(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
            {editingTemplate ? "Upravit šablonu" : `Nová šablona připomínky ${getModuleLabel()}`}
            </DialogTitle>
            <DialogDescription>
              {activeModule === "trainings" ? (
                <>
                  Vytvořte šablonu pro automatické připomínky školení. Můžete použít proměnné: 
                  <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">{'{{training_name}}'}</code>,
                  <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">{'{{days_remaining}}'}</code>
                </>
              ) : activeModule === "deadlines" ? (
                <>
                  Vytvořte šablonu pro automatické připomínky technických událostí. Můžete použít proměnné: 
                  <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">{'{{equipmentName}}'}</code>,
                  <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">{'{{deadlineType}}'}</code>,
                  <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">{'{{daysLeft}}'}</code>
                </>
              ) : (
                <>
                  Vytvořte šablonu pro automatické připomínky lékařských prohlídek. Můžete použít proměnné: 
                  <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">{'{{employeeName}}'}</code>,
                  <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">{'{{examinationType}}'}</code>,
                  <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">{'{{daysLeft}}'}</code>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Název šablony *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="např. Základní připomínka 30 dní"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Popis</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Volitelný popis šablony"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="remind_days_before">Připomenout před (dny) *</Label>
                <Input
                  id="remind_days_before"
                  type="number"
                  min="1"
                  value={formData.remind_days_before}
                  onChange={(e) => setFormData({ ...formData, remind_days_before: parseInt(e.target.value) || 30 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="repeat_interval_days">Opakovat každých (dny)</Label>
                <Input
                  id="repeat_interval_days"
                  type="number"
                  min="0"
                  value={formData.repeat_interval_days}
                  onChange={(e) => setFormData({ ...formData, repeat_interval_days: parseInt(e.target.value) || 0 })}
                  placeholder="0 = neopakovat"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_subject">Předmět emailu *</Label>
              <Input
                id="email_subject"
                value={formData.email_subject}
                onChange={(e) => setFormData({ ...formData, email_subject: e.target.value })}
                placeholder="např. Připomínka: Blíží se konec platnosti školení"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_body">Text emailu *</Label>
              <Textarea
                id="email_body"
                value={formData.email_body}
                onChange={(e) => setFormData({ ...formData, email_body: e.target.value })}
                rows={10}
                placeholder="Text připomínky..."
              />
               <p className="text-xs text-muted-foreground">
                 {activeModule === "trainings" ? (
                   <>Použijte <code>{'{{training_name}}'}</code> pro název školení a <code>{'{{days_remaining}}'}</code> pro zbývající dny</>
                 ) : activeModule === "deadlines" ? (
                   <>Použijte <code>{'{{equipmentName}}'}</code>, <code>{'{{deadlineType}}'}</code> a <code>{'{{daysLeft}}'}</code></>
                 ) : (
                   <>Použijte <code>{'{{employeeName}}'}</code>, <code>{'{{examinationType}}'}</code> a <code>{'{{daysLeft}}'}</code></>
                 )}
               </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Aktivní šablona
              </Label>
            </div>

            <Alert className="bg-accent/50 border-primary/30">
              <Bell className="h-4 w-4 text-primary" />
              <AlertDescription>
                <p className="font-semibold mb-2">Příjemci připomínek:</p>
                <p className="text-sm">
                  Příjemci pro odesílání těchto připomínek se nastavují v <strong>Administraci → Příjemci</strong> pro každý modul zvlášť. 
                  Tato šablona bude odeslána všem nakonfigurovaným příjemcům pro {getModuleLabel()}.
                </p>
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setPreviewDialogOpen(true)}
              disabled={!formData.email_subject || !formData.email_body}
            >
              <Bell className="w-4 h-4 mr-2" />
              Náhled emailu
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setCreateDialogOpen(false);
                setEditingTemplate(null);
              }}
            >
              <X className="w-4 h-4 mr-2" />
              Zrušit
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {editingTemplate ? "Uložit změny" : "Vytvořit šablonu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pro potvrzení smazání */}
      <Dialog 
        open={!!deleteDialogOpen} 
        onOpenChange={(open) => !open && setDeleteDialogOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Smazat šablonu?</DialogTitle>
            <DialogDescription>
              Opravdu chcete smazat tuto šablonu připomínky? Tato akce je nevratná.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(null)}>
              Zrušit
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteDialogOpen && handleDelete(deleteDialogOpen)}
              disabled={loading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Smazat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pro náhled emailu */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Náhled připomínkového emailu</DialogTitle>
            <DialogDescription>
              {activeModule === "trainings" 
                ? 'Ukázka emailu s nahrazenými proměnnými (příklad: školení "Bezpečnost práce", 15 dní do vypršení)'
                : activeModule === "deadlines"
                  ? 'Ukázka emailu s nahrazenými proměnnými (příklad: zařízení "Hasící přístroj A1", revize, 15 dní)'
                  : 'Ukázka emailu s nahrazenými proměnnými (příklad: zaměstnanec "Jan Novák", vstupní prohlídka, 15 dní)'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Předmět:</Label>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm">{getPreviewEmail().subject}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Text emailu:</Label>
              <div className="p-4 bg-muted rounded-md min-h-32">
                <p className="text-sm whitespace-pre-wrap">{getPreviewEmail().body}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground p-3 bg-accent/10 rounded">
              <p className="font-semibold mb-1">Dostupné proměnné:</p>
              {activeModule === "trainings" ? (
                <ul className="list-disc list-inside space-y-1">
                  <li><code>{'{{training_name}}'}</code> - název školení</li>
                  <li><code>{'{{days_remaining}}'}</code> - počet dní do vypršení</li>
                </ul>
              ) : activeModule === "deadlines" ? (
                <ul className="list-disc list-inside space-y-1">
                  <li><code>{'{{equipmentName}}'}</code> - název zařízení</li>
                  <li><code>{'{{deadlineType}}'}</code> - typ lhůty (revize, kalibrace...)</li>
                  <li><code>{'{{daysLeft}}'}</code> - počet dní do vypršení</li>
                  <li><code>{'{{inventoryNumber}}'}</code> - inventární číslo</li>
                  <li><code>{'{{nextDue}}'}</code> - datum další kontroly</li>
                </ul>
              ) : (
                <ul className="list-disc list-inside space-y-1">
                  <li><code>{'{{employeeName}}'}</code> - jméno zaměstnance</li>
                  <li><code>{'{{examinationType}}'}</code> - typ prohlídky</li>
                  <li><code>{'{{daysLeft}}'}</code> - počet dní do vypršení</li>
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Zavřít
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};