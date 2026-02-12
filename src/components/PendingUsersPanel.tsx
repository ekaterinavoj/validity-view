import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, UserCheck, UserX, Clock, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface PendingUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  position?: string;
  approval_status: string;
  created_at: string;
  has_role: boolean;
}

export function PendingUsersPanel() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject';
    user: PendingUser | null;
  }>({ open: false, action: 'approve', user: null });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const loadPendingUsers = async () => {
    setLoading(true);
    try {
      // Get all pending profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get roles only for pending users
      const pendingIds = profiles?.map(p => p.id) || [];
      const { data: roles, error: rolesError } = pendingIds.length > 0
        ? await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', pendingIds)
        : { data: [] as { user_id: string; role: string }[], error: null };

      if (rolesError) throw rolesError;

      const rolesByUser = new Map<string, string[]>();
      roles?.forEach(r => {
        const existing = rolesByUser.get(r.user_id) || [];
        existing.push(r.role);
        rolesByUser.set(r.user_id, existing);
      });

      const usersWithRoles = profiles?.map(profile => ({
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        position: profile.position,
        approval_status: profile.approval_status,
        created_at: profile.created_at,
        has_role: (rolesByUser.get(profile.id)?.length || 0) > 0,
      })) || [];

      setPendingUsers(usersWithRoles);
      
      // Set default role for each user
      const defaultRoles: Record<string, string> = {};
      usersWithRoles.forEach(u => {
        defaultRoles[u.id] = 'user';
      });
      setSelectedRole(defaultRoles);
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

  const handleApprove = async (pendingUser: PendingUser) => {
    setProcessing(true);
    try {
      const roleToAssign = selectedRole[pendingUser.id] || 'user';

      // Update approval status
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'approved',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', pendingUser.id);

      if (updateError) throw updateError;

      // Remove any existing roles first, then insert the selected one
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', pendingUser.id);

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: pendingUser.id,
          role: roleToAssign as "admin" | "manager" | "user" | "viewer",
          created_by: user?.id,
        });

      if (roleError) throw roleError;

      toast({
        title: "Uživatel schválen",
        description: `${pendingUser.first_name} ${pendingUser.last_name} byl schválen s rolí ${roleToAssign}.`,
      });

      // Refresh list
      loadPendingUsers();
      refreshProfile();
    } catch (error: any) {
      toast({
        title: "Chyba při schvalování",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setConfirmDialog({ open: false, action: 'approve', user: null });
    }
  };

  const handleReject = async (pendingUser: PendingUser) => {
    setProcessing(true);
    try {
      // Update approval status to rejected
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          approval_status: 'rejected',
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', pendingUser.id);

      if (updateError) throw updateError;

      // Remove any existing roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', pendingUser.id);

      toast({
        title: "Uživatel zamítnut",
        description: `${pendingUser.first_name} ${pendingUser.last_name} byl zamítnut a nemá přístup do systému.`,
      });

      // Refresh list
      loadPendingUsers();
    } catch (error: any) {
      toast({
        title: "Chyba při zamítání",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setConfirmDialog({ open: false, action: 'reject', user: null });
    }
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrátor',
    manager: 'Manažer',
    user: 'Uživatel',
    viewer: 'Prohlížeč',
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
              <Clock className="w-5 h-5" />
              Čekající uživatelé na schválení
              {pendingUsers.length > 0 && (
                <Badge variant="secondary">{pendingUsers.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Schvalte nebo zamítněte registrace nových uživatelů
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadPendingUsers}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {pendingUsers.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Žádní uživatelé nečekají na schválení</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Uživatel</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Pozice</TableHead>
                <TableHead>Registrace</TableHead>
                <TableHead>Přidělit roli</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingUsers.map((pendingUser) => (
                <TableRow key={pendingUser.id}>
                  <TableCell className="font-medium">
                    {pendingUser.first_name} {pendingUser.last_name}
                  </TableCell>
                  <TableCell>{pendingUser.email}</TableCell>
                  <TableCell>{pendingUser.position || '-'}</TableCell>
                  <TableCell>
                    {format(new Date(pendingUser.created_at), 'dd.MM.yyyy HH:mm', { locale: cs })}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={selectedRole[pendingUser.id] || 'user'}
                      onValueChange={(value) => 
                        setSelectedRole({ ...selectedRole, [pendingUser.id]: value })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Prohlížeč</SelectItem>
                        <SelectItem value="user">Uživatel</SelectItem>
                        <SelectItem value="manager">Manažer</SelectItem>
                        <SelectItem value="admin">Administrátor</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => setConfirmDialog({ 
                          open: true, 
                          action: 'approve', 
                          user: pendingUser 
                        })}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Schválit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmDialog({ 
                          open: true, 
                          action: 'reject', 
                          user: pendingUser 
                        })}
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        Zamítnout
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {pendingUsers.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Neschválení uživatelé jsou blokováni RLS politikami a nemají přístup k datům.
              Po schválení získají přístup podle přidělené role.
            </p>
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={confirmDialog.open} 
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'approve' ? 'Schválit uživatele?' : 'Zamítnout uživatele?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'approve' ? (
                <>
                  Uživatel <strong>{confirmDialog.user?.first_name} {confirmDialog.user?.last_name}</strong> bude 
                  schválen s rolí <strong>{roleLabels[selectedRole[confirmDialog.user?.id || ''] || 'user']}</strong> a 
                  získá přístup do systému.
                </>
              ) : (
                <>
                  Uživatel <strong>{confirmDialog.user?.first_name} {confirmDialog.user?.last_name}</strong> bude 
                  zamítnut a nebude mít přístup do systému. Tato akce je zaznamenána v audit logu.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.user) {
                  if (confirmDialog.action === 'approve') {
                    handleApprove(confirmDialog.user);
                  } else {
                    handleReject(confirmDialog.user);
                  }
                }
              }}
              disabled={processing}
              className={confirmDialog.action === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {confirmDialog.action === 'approve' ? 'Schválit' : 'Zamítnout'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}