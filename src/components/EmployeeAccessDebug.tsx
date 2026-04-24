import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ShieldCheck, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDateTime } from "@/lib/dateFormat";

interface UserOption {
  id: string;
  label: string;
  role: string;
}

interface VisibilityRow {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  reason: string;
}

interface AccessLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  rows_returned: number | null;
  filters: Record<string, unknown> | null;
  source: string | null;
  created_at: string;
}

const reasonVariant = (reason: string): "default" | "secondary" | "outline" => {
  if (reason.startsWith("admin")) return "default";
  if (reason.startsWith("manager")) return "secondary";
  return "outline";
};

export function EmployeeAccessDebug() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [visibility, setVisibility] = useState<VisibilityRow[]>([]);
  const [loadingVis, setLoadingVis] = useState(false);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Load users with role
  useEffect(() => {
    (async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("approval_status", "approved")
        .order("last_name");
      if (error || !profiles) return;

      const enriched: UserOption[] = await Promise.all(
        profiles.map(async (p) => {
          const { data: roles } = await supabase.rpc("get_user_roles", { _user_id: p.id });
          const role = (roles ?? [])[0] ?? "user";
          return {
            id: p.id,
            label: `${p.last_name} ${p.first_name} (${p.email})`,
            role,
          };
        })
      );
      setUsers(enriched);
    })();
  }, []);

  // Load access logs
  useEffect(() => {
    (async () => {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from("employee_access_logs" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error && data) setLogs(data as unknown as AccessLog[]);
      setLoadingLogs(false);
    })();
  }, []);

  const runDebug = async (userId: string) => {
    setSelectedUser(userId);
    if (!userId) {
      setVisibility([]);
      return;
    }
    setLoadingVis(true);
    const { data, error } = await supabase.rpc("debug_employee_visibility" as never, {
      _target_user_id: userId,
    } as never);
    setLoadingVis(false);
    if (error) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setVisibility((data ?? []) as unknown as VisibilityRow[]);
  };

  const selectedUserMeta = users.find((u) => u.id === selectedUser);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Debug viditelnosti zaměstnanců
          </CardTitle>
          <CardDescription>
            Zobrazí, které zaměstnance daný uživatel uvidí podle aktuálního RLS pravidla a proč
            (admin / manažerská hierarchie / vlastní záznam).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={selectedUser} onValueChange={runDebug}>
              <SelectTrigger className="sm:w-[420px]">
                <SelectValue placeholder="Vyberte uživatele…" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label} — <span className="opacity-70">{u.role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedUserMeta && (
              <Badge variant="secondary">Role: {selectedUserMeta.role}</Badge>
            )}
            {visibility.length > 0 && (
              <Badge>{visibility.length} viditelných záznamů</Badge>
            )}
          </div>

          {loadingVis ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
            </div>
          ) : selectedUser && visibility.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tento uživatel nemá viditelné žádné zaměstnance.
            </p>
          ) : visibility.length > 0 ? (
            <ScrollArea className="max-h-[420px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zaměstnanec</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Důvod přístupu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibility.map((row) => (
                    <TableRow key={row.employee_id}>
                      <TableCell>{row.employee_name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.employee_email}</TableCell>
                      <TableCell>
                        <Badge variant={reasonVariant(row.reason)}>{row.reason}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Audit přístupu k zaměstnancům
          </CardTitle>
          <CardDescription>
            Posledních 100 záznamů o čtení tabulky zaměstnanců (kdo, role, kolik záznamů, jaký
            kontext).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím žádné záznamy.</p>
          ) : (
            <ScrollArea className="max-h-[480px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Čas</TableHead>
                    <TableHead>Uživatel</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Akce</TableHead>
                    <TableHead className="text-right">Počet</TableHead>
                    <TableHead>Filtry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell>{log.user_email ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.user_role ?? "?"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {log.rows_returned ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                        {log.filters ? JSON.stringify(log.filters) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
