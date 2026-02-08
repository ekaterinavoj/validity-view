import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, UserCheck, AlertCircle, GraduationCap, Wrench, Save, Users } from "lucide-react";

interface UserWithRole {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface ResponsibilityGroup {
  id: string;
  name: string;
  is_active: boolean;
  member_count: number;
}

interface ModuleRecipients {
  user_ids: string[];
  group_ids?: string[];
  delivery_mode: string;
}

const DELIVERY_MODES = [
  { value: "bcc", label: "BCC (skrytá kopie)" },
  { value: "to", label: "To (příjemci viditelní)" },
  { value: "cc", label: "CC (kopie)" },
];

interface ModuleRecipientsSelectorProps {
  onTrainingRecipientsChange?: (recipients: ModuleRecipients) => void;
  onDeadlineRecipientsChange?: (recipients: ModuleRecipients) => void;
}

export function ModuleRecipientsSelector({ 
  onTrainingRecipientsChange, 
  onDeadlineRecipientsChange 
}: ModuleRecipientsSelectorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [groups, setGroups] = useState<ResponsibilityGroup[]>([]);
  const [activeModule, setActiveModule] = useState<"training" | "deadlines">("training");
  
  // Training module recipients
  const [trainingRecipients, setTrainingRecipients] = useState<ModuleRecipients>({
    user_ids: [],
    delivery_mode: "bcc",
  });
  
  // Deadlines module recipients (includes group support)
  const [deadlineRecipients, setDeadlineRecipients] = useState<ModuleRecipients>({
    user_ids: [],
    group_ids: [],
    delivery_mode: "bcc",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load users
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
        };
      }) || [];
      
      setUsers(usersWithRoles);

      // Load responsibility groups with member count
      const { data: groupsData, error: groupsError } = await supabase
        .from("responsibility_groups")
        .select(`
          id,
          name,
          is_active,
          members:responsibility_group_members(id)
        `)
        .eq("is_active", true)
        .order("name");
      
      if (groupsError) throw groupsError;
      
      const groupsWithCount = (groupsData || []).map(g => ({
        id: g.id,
        name: g.name,
        is_active: g.is_active,
        member_count: Array.isArray(g.members) ? g.members.length : 0,
      }));
      
      setGroups(groupsWithCount);

      // Load settings
      const { data: settings } = await supabase
        .from("system_settings")
        .select("*")
        .in("key", ["reminder_recipients", "deadline_reminder_recipients"]);
      
      settings?.forEach((setting) => {
        if (setting.key === "reminder_recipients" && setting.value && typeof setting.value === 'object' && !Array.isArray(setting.value)) {
          const val = setting.value as Record<string, unknown>;
          setTrainingRecipients(prev => ({ 
            ...prev, 
            user_ids: Array.isArray(val.user_ids) ? val.user_ids as string[] : prev.user_ids,
            delivery_mode: typeof val.delivery_mode === 'string' ? val.delivery_mode : prev.delivery_mode,
          }));
        } else if (setting.key === "deadline_reminder_recipients" && setting.value && typeof setting.value === 'object' && !Array.isArray(setting.value)) {
          const val = setting.value as Record<string, unknown>;
          setDeadlineRecipients(prev => ({ 
            ...prev, 
            user_ids: Array.isArray(val.user_ids) ? val.user_ids as string[] : prev.user_ids,
            group_ids: Array.isArray(val.group_ids) ? val.group_ids as string[] : [],
            delivery_mode: typeof val.delivery_mode === 'string' ? val.delivery_mode : prev.delivery_mode,
          }));
        }
      });
    } catch (error: any) {
      toast({
        title: "Chyba při načítání",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: any) => {
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting("reminder_recipients", trainingRecipients),
        saveSetting("deadline_reminder_recipients", deadlineRecipients),
      ]);
      
      onTrainingRecipientsChange?.(trainingRecipients);
      onDeadlineRecipientsChange?.(deadlineRecipients);
      
      toast({
        title: "Uloženo",
        description: "Příjemci byli úspěšně uloženi pro oba moduly.",
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

  const handleRecipientToggle = (module: "training" | "deadlines", userId: string, checked: boolean) => {
    if (module === "training") {
      setTrainingRecipients(prev => ({
        ...prev,
        user_ids: checked 
          ? [...prev.user_ids, userId]
          : prev.user_ids.filter(id => id !== userId),
      }));
    } else {
      setDeadlineRecipients(prev => ({
        ...prev,
        user_ids: checked 
          ? [...prev.user_ids, userId]
          : prev.user_ids.filter(id => id !== userId),
      }));
    }
  };

  const handleGroupToggle = (groupId: string, checked: boolean) => {
    setDeadlineRecipients(prev => ({
      ...prev,
      group_ids: checked 
        ? [...(prev.group_ids || []), groupId]
        : (prev.group_ids || []).filter(id => id !== groupId),
    }));
  };

  const getSelectedDisplay = (recipients: ModuleRecipients, includeGroups = false) => {
    const selectedUsers = users.filter(u => recipients.user_ids.includes(u.id));
    const selectedGroups = includeGroups 
      ? groups.filter(g => recipients.group_ids?.includes(g.id))
      : [];
    
    const totalCount = selectedUsers.length + selectedGroups.length;
    
    if (totalCount === 0) return "Žádní příjemci";
    
    const parts: string[] = [];
    if (selectedUsers.length > 0) {
      parts.push(`${selectedUsers.length} uživatel${selectedUsers.length === 1 ? '' : selectedUsers.length < 5 ? 'é' : 'ů'}`);
    }
    if (selectedGroups.length > 0) {
      parts.push(`${selectedGroups.length} skupin${selectedGroups.length === 1 ? 'a' : selectedGroups.length < 5 ? 'y' : ''}`);
    }
    
    return parts.join(", ");
  };

  const renderRecipientsList = (module: "training" | "deadlines") => {
    const recipients = module === "training" ? trainingRecipients : deadlineRecipients;
    const showGroups = module === "deadlines";
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label>Vybraní příjemci</Label>
            <p className="text-sm text-muted-foreground mt-1">
              {getSelectedDisplay(recipients, showGroups)}
            </p>
          </div>
          <div className="w-48">
            <Label>Způsob doručení</Label>
            <Select
              value={recipients.delivery_mode}
              onValueChange={(value) => {
                if (module === "training") {
                  setTrainingRecipients({ ...trainingRecipients, delivery_mode: value });
                } else {
                  setDeadlineRecipients({ ...deadlineRecipients, delivery_mode: value });
                }
              }}
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

        {/* Groups section - only for deadlines module */}
        {showGroups && groups.length > 0 && (
          <>
            <div>
              <Label className="mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Skupiny odpovědných osob
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Všichni členové vybrané skupiny obdrží připomínky
              </p>
              <ScrollArea className="h-[150px] border rounded-md p-3">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <div 
                        key={group.id} 
                        className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md"
                      >
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={deadlineRecipients.group_ids?.includes(group.id) || false}
                          onCheckedChange={(checked) => 
                            handleGroupToggle(group.id, checked as boolean)
                          }
                        />
                        <label 
                          htmlFor={`group-${group.id}`}
                          className="flex-1 cursor-pointer flex items-center gap-2"
                        >
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{group.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {group.member_count} {group.member_count === 1 ? 'člen' : group.member_count < 5 ? 'členové' : 'členů'}
                          </Badge>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
            <Separator />
          </>
        )}

        <div>
          <Label className="mb-2 block">
            {showGroups ? "Jednotliví uživatelé (kromě skupin)" : "Vybrat příjemce z uživatelů systému"}
          </Label>
          <ScrollArea className="h-[200px] border rounded-md p-3">
            {loading ? (
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
                      id={`${module}-recipient-${user.id}`}
                      checked={recipients.user_ids.includes(user.id)}
                      onCheckedChange={(checked) => 
                        handleRecipientToggle(module, user.id, checked as boolean)
                      }
                    />
                    <label 
                      htmlFor={`${module}-recipient-${user.id}`}
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

        {recipients.delivery_mode === "bcc" && (
          <div className="p-3 bg-muted/50 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              V režimu BCC nebudou příjemci vidět ostatní příjemce emailu.
            </p>
          </div>
        )}

        {recipients.user_ids.length === 0 && (!showGroups || (deadlineRecipients.group_ids || []).length === 0) && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">
              Připomínky pro tento modul nebudou odesílány, dokud nevyberete alespoň jednoho příjemce{showGroups ? " nebo skupinu" : ""}.
            </p>
          </div>
        )}
      </div>
    );
  };

  const getDeadlineRecipientsCount = () => {
    return deadlineRecipients.user_ids.length + (deadlineRecipients.group_ids?.length || 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Příjemci připomínek podle modulu
            </CardTitle>
            <CardDescription>
              Nastavte příjemce souhrnných emailů zvlášť pro Školení a Technické lhůty
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Uložit
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as "training" | "deadlines")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="training" className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              Školení
              {trainingRecipients.user_ids.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {trainingRecipients.user_ids.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="deadlines" className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Technické lhůty
              {getDeadlineRecipientsCount() > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {getDeadlineRecipientsCount()}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="training" className="mt-4">
            {renderRecipientsList("training")}
          </TabsContent>

          <TabsContent value="deadlines" className="mt-4">
            {renderRecipientsList("deadlines")}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
