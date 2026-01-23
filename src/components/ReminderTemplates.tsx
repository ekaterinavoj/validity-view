import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, Save, X, Bell, Play, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

export const ReminderTemplates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
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
    target_user_ids: [] as string[],
  });

  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; email: string; full_name: string }>>([]);
  const [runningCheck, setRunningCheck] = useState(false);
  const [checkResult, setCheckResult] = useState<{ total_emails_sent: number; results: any[]; info?: string; message?: string } | null>(null);

  useEffect(() => {
    loadTemplates();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .order("email");

      if (error) throw error;
      
      const formattedUsers = (data || []).map(user => ({
        id: user.id,
        email: user.email,
        full_name: `${user.first_name} ${user.last_name}`.trim() || user.email
      }));
      
      setUsers(formattedUsers);
    } catch (error: any) {
      console.error("Error loading users:", error);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("reminder_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
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
      target_user_ids: [],
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
      target_user_ids: (template as any).target_user_ids || [],
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
      if (editingTemplate) {
        // Aktualizace existující šablony
        const { error } = await supabase
          .from("reminder_templates")
          .update({
            name: formData.name,
            description: formData.description,
            remind_days_before: formData.remind_days_before,
            repeat_interval_days: formData.repeat_interval_days || null,
            email_subject: formData.email_subject,
            email_body: formData.email_body,
            is_active: formData.is_active,
            target_user_ids: formData.target_user_ids,
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;

        toast({
          title: "Šablona aktualizována",
          description: "Šablona připomínky byla úspěšně aktualizována.",
        });
      } else {
        // Vytvoření nové šablony
        const { error } = await supabase
          .from("reminder_templates")
          .insert([{
            ...formData,
            target_user_ids: formData.target_user_ids,
          }]);

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
        .from("reminder_templates")
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
        .from("reminder_templates")
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
    const subject = formData.email_subject
      .replace(/\{\{training_name\}\}/g, "Bezpečnost práce")
      .replace(/\{\{days_remaining\}\}/g, "15");
    
    const body = formData.email_body
      .replace(/\{\{training_name\}\}/g, "Bezpečnost práce")
      .replace(/\{\{days_remaining\}\}/g, "15");
    
    return { subject, body };
  };

  const handleRunCheck = async () => {
    setRunningCheck(true);
    setCheckResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-training-reminders', {
        body: { manual_trigger: true }
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
      {/* Manuální kontrola připomínek */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Manuální kontrola připomínek
          </CardTitle>
          <CardDescription>
            Spusťte okamžitou kontrolu školení a odešlete připomínky bez čekání na automatickou kontrolu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Jak funguje manuální kontrola:</p>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>Systém projde všechny aktivní šablony připomínek</li>
                <li>Zkontroluje školení, kterým brzy vyprší platnost</li>
                <li>Odešle připomínkové emaily podle nastavených šablon</li>
                <li>Zobrazí výsledek - kolik emailů bylo odesláno</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                <strong>Poznámka:</strong> Pro odeslání emailů musí být nastaven RESEND_API_KEY.
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
                Šablony připomínek školení
              </CardTitle>
              <CardDescription>
                Vytvořte a spravujte šablony pro automatické připomínky školení
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
                            <span className="font-medium">{template.remind_days_before} dní před vypršením</span>
                          </div>
                          {template.repeat_interval_days && template.repeat_interval_days > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Opakovat každých:</span>
                              <span className="font-medium">{template.repeat_interval_days} dní</span>
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
              {editingTemplate ? "Upravit šablonu" : "Nová šablona připomínky"}
            </DialogTitle>
            <DialogDescription>
              Vytvořte šablonu pro automatické připomínky školení. Můžete použít proměnné: 
              <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">{'{{training_name}}'}</code>,
              <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">{'{{days_remaining}}'}</code>
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
                Použijte <code>{'{{training_name}}'}</code> pro název školení a <code>{'{{days_remaining}}'}</code> pro zbývající dny
              </p>
            </div>

            <div className="space-y-2">
              <Label>Příjemci připomínek</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Načítání uživatelů...</p>
                ) : (
                  users.map((user) => (
                    <label key={user.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={formData.target_user_ids.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              target_user_ids: [...formData.target_user_ids, user.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              target_user_ids: formData.target_user_ids.filter(id => id !== user.id)
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{user.full_name} ({user.email})</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Pokud nevyberete žádného uživatele, připomínky se odešlou všem oprávněným uživatelům
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
              Ukázka emailu s nahrazenými proměnnými (příklad: školení "Bezpečnost práce", 15 dní do vypršení)
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
              <ul className="list-disc list-inside space-y-1">
                <li><code>{'{{training_name}}'}</code> - název školení</li>
                <li><code>{'{{days_remaining}}'}</code> - počet dní do vypršení</li>
              </ul>
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