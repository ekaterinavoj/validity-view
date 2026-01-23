import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, UserPlus, Mail, Copy, Trash2, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

interface UserInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  used_at?: string;
  invited_by_name?: string;
}

interface InviterProfile {
  id: string;
  first_name: string;
  last_name: string;
}

export function UserInvitePanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; invite: UserInvite | null }>({
    open: false,
    invite: null,
  });
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState({
    email: '',
    role: 'user' as 'admin' | 'manager' | 'user',
  });

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_invites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get inviter profiles
      const inviterIds = [...new Set(data?.map(i => i.invited_by) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', inviterIds);

      const profileMap = new Map<string, InviterProfile>();
      profiles?.forEach(p => profileMap.set(p.id, p));

      const invitesWithNames = data?.map(invite => ({
        ...invite,
        invited_by_name: profileMap.get(invite.invited_by)
          ? `${profileMap.get(invite.invited_by)!.first_name} ${profileMap.get(invite.invited_by)!.last_name}`
          : 'Neznámý',
      })) || [];

      setInvites(invitesWithNames);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání pozvánek",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!newInvite.email) {
      toast({
        title: "Chybí email",
        description: "Zadejte emailovou adresu pro pozvánku",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newInvite.email)) {
      toast({
        title: "Neplatný email",
        description: "Zadejte platnou emailovou adresu",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      // Check if invite already exists
      const { data: existing } = await supabase
        .from('user_invites')
        .select('id')
        .eq('email', newInvite.email.toLowerCase())
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        toast({
          title: "Pozvánka již existuje",
          description: "Pro tento email již existuje aktivní pozvánka",
          variant: "destructive",
        });
        setCreating(false);
        return;
      }

      // Create invite
      const { data, error } = await supabase
        .from('user_invites')
        .insert({
          email: newInvite.email.toLowerCase(),
          role: newInvite.role,
          invited_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log to audit
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'user_invites',
          record_id: data.id,
          action: 'INVITE_CREATED',
          new_data: { email: newInvite.email, role: newInvite.role },
          user_id: user?.id,
        });

      toast({
        title: "Pozvánka vytvořena",
        description: `Pozvánka pro ${newInvite.email} byla vytvořena. Uživatel se nyní může zaregistrovat.`,
      });

      setCreateDialogOpen(false);
      setNewInvite({ email: '', role: 'user' });
      loadInvites();
    } catch (error: any) {
      toast({
        title: "Chyba při vytváření pozvánky",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInvite = async (invite: UserInvite) => {
    try {
      const { error } = await supabase
        .from('user_invites')
        .update({ status: 'revoked' })
        .eq('id', invite.id);

      if (error) throw error;

      toast({
        title: "Pozvánka zrušena",
        description: `Pozvánka pro ${invite.email} byla zrušena.`,
      });

      loadInvites();
    } catch (error: any) {
      toast({
        title: "Chyba při rušení pozvánky",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialog({ open: false, invite: null });
    }
  };

  const copyInviteLink = (email: string) => {
    const baseUrl = window.location.origin;
    const inviteUrl = `${baseUrl}/auth?invite_email=${encodeURIComponent(email)}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: "Odkaz zkopírován",
      description: "Odkaz na registraci byl zkopírován do schránky.",
    });
  };

  const getStatusBadge = (invite: UserInvite) => {
    const isExpired = new Date(invite.expires_at) < new Date();
    
    if (invite.status === 'used') {
      return <Badge variant="default" className="bg-primary"><CheckCircle className="w-3 h-3 mr-1" /> Využita</Badge>;
    }
    if (invite.status === 'revoked') {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Zrušena</Badge>;
    }
    if (isExpired) {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Vypršela</Badge>;
    }
    return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Čeká</Badge>;
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrátor',
    manager: 'Manažer',
    user: 'Uživatel',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Pozvánky uživatelů
            </CardTitle>
            <CardDescription>
              Vytvořte pozvánky pro nové uživatele. Pouze pozvaní uživatelé se mohou registrovat (v režimu invite-only).
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadInvites}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Obnovit
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Nová pozvánka
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vytvořit novou pozvánku</DialogTitle>
                  <DialogDescription>
                    Pozvěte nového uživatele zadáním jeho emailu a role, kterou mu chcete přidělit.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="uzivatel@firma.cz"
                      value={newInvite.email}
                      onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select
                      value={newInvite.role}
                      onValueChange={(value) => setNewInvite({ ...newInvite, role: value as 'admin' | 'manager' | 'user' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Uživatel</SelectItem>
                        <SelectItem value="manager">Manažer</SelectItem>
                        <SelectItem value="admin">Administrátor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Pozvánka bude platná 7 dní. Po registraci bude uživateli automaticky přidělena vybraná role.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Zrušit
                  </Button>
                  <Button onClick={handleCreateInvite} disabled={creating}>
                    {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Vytvořit pozvánku
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {invites.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Zatím nebyly vytvořeny žádné pozvánky</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Vytvořil</TableHead>
                <TableHead>Platnost</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{roleLabels[invite.role]}</Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(invite)}</TableCell>
                  <TableCell>{invite.invited_by_name}</TableCell>
                  <TableCell>
                    {invite.status === 'used' ? (
                      <span className="text-sm text-muted-foreground">
                        Využita {format(new Date(invite.used_at!), 'dd.MM.yyyy', { locale: cs })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true, locale: cs })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {invite.status === 'pending' && new Date(invite.expires_at) > new Date() && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyInviteLink(invite.email)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteDialog({ open: true, invite })}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zrušit pozvánku?</AlertDialogTitle>
            <AlertDialogDescription>
              Pozvánka pro <strong>{deleteDialog.invite?.email}</strong> bude zrušena a uživatel se nebude moci
              pomocí ní zaregistrovat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne, ponechat</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.invite && handleDeleteInvite(deleteDialog.invite)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Ano, zrušit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}