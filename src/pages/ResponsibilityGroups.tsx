import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, Users, Loader2, UserPlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ResponsibilityGroup {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface GroupMember {
  id: string;
  profile_id: string;
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function ResponsibilityGroups() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<ResponsibilityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [membersDialogOpen, setMembersDialogOpen] = useState<string | null>(null);
  
  const [editingGroup, setEditingGroup] = useState<ResponsibilityGroup | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("responsibility_groups")
        .select("*")
        .order("name");

      if (error) throw error;
      setGroups(data || []);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání skupin",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      const { data: membersData, error: membersError } = await supabase
        .from("responsibility_group_members")
        .select(`
          id,
          profile_id,
          profile:profiles(id, first_name, last_name, email)
        `)
        .eq("group_id", groupId);

      if (membersError) throw membersError;

      // Transform the data to handle the nested profile correctly
      const transformedMembers = (membersData || []).map(m => ({
        id: m.id,
        profile_id: m.profile_id,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile
      }));

      setMembers(transformedMembers);

      // Load available profiles (not already members)
      const memberIds = transformedMembers.map(m => m.profile_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("approval_status", "approved")
        .order("last_name");

      if (profilesError) throw profilesError;

      setAvailableProfiles(
        (profilesData || []).filter(p => !memberIds.includes(p.id))
      );
    } catch (error: any) {
      toast({
        title: "Chyba při načítání členů",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCreate = () => {
    setEditingGroup(null);
    setFormData({ name: "", description: "", is_active: true });
    setDialogOpen(true);
  };

  const handleEdit = (group: ResponsibilityGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || "",
      is_active: group.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Chybí název",
        description: "Zadejte prosím název skupiny.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from("responsibility_groups")
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active,
          })
          .eq("id", editingGroup.id);

        if (error) throw error;

        toast({ title: "Skupina aktualizována" });
      } else {
        const { error } = await supabase
          .from("responsibility_groups")
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active,
          });

        if (error) throw error;

        toast({ title: "Skupina vytvořena" });
      }

      setDialogOpen(false);
      loadGroups();
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

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("responsibility_groups")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Skupina smazána" });
      setDeleteDialogOpen(null);
      loadGroups();
    } catch (error: any) {
      toast({
        title: "Chyba při mazání",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleOpenMembers = (groupId: string) => {
    setMembersDialogOpen(groupId);
    loadMembers(groupId);
  };

  const handleAddMember = async () => {
    if (!selectedProfileId || !membersDialogOpen) return;

    try {
      const { error } = await supabase
        .from("responsibility_group_members")
        .insert({
          group_id: membersDialogOpen,
          profile_id: selectedProfileId,
        });

      if (error) throw error;

      toast({ title: "Člen přidán" });
      setSelectedProfileId("");
      loadMembers(membersDialogOpen);
    } catch (error: any) {
      toast({
        title: "Chyba při přidávání člena",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!membersDialogOpen) return;

    try {
      const { error } = await supabase
        .from("responsibility_group_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast({ title: "Člen odebrán" });
      loadMembers(membersDialogOpen);
    } catch (error: any) {
      toast({
        title: "Chyba při odebírání člena",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (group: ResponsibilityGroup) => {
    try {
      const { error } = await supabase
        .from("responsibility_groups")
        .update({ is_active: !group.is_active })
        .eq("id", group.id);

      if (error) throw error;

      toast({
        title: group.is_active ? "Skupina deaktivována" : "Skupina aktivována",
      });
      loadGroups();
    } catch (error: any) {
      toast({
        title: "Chyba při změně stavu",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Skupiny odpovědných osob</h1>
          <p className="text-muted-foreground mt-1">
            Správa skupin pro přiřazení odpovědnosti za technické události
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nová skupina
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="w-[200px]">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Zatím nejsou vytvořeny žádné skupiny.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {group.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={group.is_active ? "default" : "secondary"}>
                        {group.is_active ? "Aktivní" : "Neaktivní"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenMembers(group.id)}
                          title="Členové skupiny"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(group)}
                          title="Upravit"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Switch
                          checked={group.is_active}
                          onCheckedChange={() => handleToggleActive(group)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteDialogOpen(group.id)}
                          title="Smazat"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Upravit skupinu" : "Nová skupina"}
            </DialogTitle>
            <DialogDescription>
              {editingGroup
                ? "Upravte údaje skupiny odpovědných osob."
                : "Vytvořte novou skupinu pro přiřazení odpovědnosti."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Název skupiny *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="např. Technici údržby"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Popis</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Volitelný popis skupiny..."
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Aktivní</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Zrušit
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingGroup ? "Uložit změny" : "Vytvořit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog
        open={!!membersDialogOpen}
        onOpenChange={(open) => !open && setMembersDialogOpen(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Členové skupiny
            </DialogTitle>
            <DialogDescription>
              Spravujte členy této skupiny odpovědných osob.
            </DialogDescription>
          </DialogHeader>

          {loadingMembers ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add member */}
              <div className="flex items-center gap-2">
                <Select
                  value={selectedProfileId}
                  onValueChange={setSelectedProfileId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Vyberte uživatele..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.first_name} {profile.last_name} ({profile.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddMember}
                  disabled={!selectedProfileId}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Přidat
                </Button>
              </div>

              {/* Members list */}
              <div className="border rounded-lg divide-y">
                {members.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Skupina zatím nemá žádné členy.
                  </div>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {member.profile.first_name} {member.profile.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.profile.email}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteDialogOpen}
        onOpenChange={(open) => !open && setDeleteDialogOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat skupinu?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Skupina bude trvale odstraněna včetně všech
              přiřazení k technickým událostem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialogOpen && handleDelete(deleteDialogOpen)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
