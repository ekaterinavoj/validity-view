import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ShieldCheck, Eye, Download, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDateTime } from "@/lib/dateFormat";
import { exportToCSV } from "@/lib/csvExport";

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
  policy_name: string;
  policy_branch: string;
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

/** Mask email like "j****@example.com" — preserves domain, hides local part */
const maskEmail = (email: string | null | undefined): string => {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(3, local.length - 1))}@${domain}`;
};

export function EmployeeAccessDebug() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [visibility, setVisibility] = useState<VisibilityRow[]>([]);
  const [loadingVis, setLoadingVis] = useState(false);

  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Email visibility toggle (admins only)
  const [showEmails, setShowEmails] = useState(false);

  // Audit log filters
  const [filterUser, setFilterUser] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

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
        .limit(500);
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

  // Filtered logs (client-side; we already limit to 500 from DB)
  const filteredLogs = useMemo(() => {
    const fromTs = filterFrom ? new Date(filterFrom).getTime() : null;
    const toTs = filterTo ? new Date(filterTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    const userQ = filterUser.trim().toLowerCase();

    return logs.filter((log) => {
      if (filterRole !== "all" && (log.user_role ?? "") !== filterRole) return false;
      if (filterAction !== "all" && log.action !== filterAction) return false;
      if (userQ && !(log.user_email ?? "").toLowerCase().includes(userQ)) return false;
      const ts = new Date(log.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
  }, [logs, filterUser, filterRole, filterAction, filterFrom, filterTo]);

  const resetFilters = () => {
    setFilterUser("");
    setFilterRole("all");
    setFilterAction("all");
    setFilterFrom("");
    setFilterTo("");
  };

  const handleExportLogs = () => {
    if (filteredLogs.length === 0) {
      toast({ title: "Nic k exportu", description: "Žádné logy neodpovídají filtrům.", variant: "destructive" });
      return;
    }
    try {
      exportToCSV({
        filename: `employee-access-logs-${new Date().toISOString().slice(0, 10)}.csv`,
        data: filteredLogs.map((log) => ({
          cas: formatDisplayDateTime(log.created_at),
          uzivatel: log.user_email ?? "",
          role: log.user_role ?? "",
          akce: log.action,
          pocet_zaznamu: log.rows_returned ?? "",
          zdroj: log.source ?? "",
          filtry: log.filters ? JSON.stringify(log.filters) : "",
        })),
      });
      toast({ title: "Export dokončen", description: `Exportováno ${filteredLogs.length} záznamů.` });
    } catch (e: any) {
      toast({ title: "Chyba exportu", description: e.message, variant: "destructive" });
    }
  };

  const displayEmail = (email: string | null | undefined) => {
    if (!email) return "—";
    if (isAdmin && showEmails) return email;
    return maskEmail(email);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Debug viditelnosti zaměstnanců
              </CardTitle>
              <CardDescription>
                Zobrazí, které zaměstnance daný uživatel uvidí podle aktuálního RLS pravidla,
                proč (admin / manažerská hierarchie / vlastní záznam) a kterou konkrétní větví
                politiky se to vyhodnocuje.
              </CardDescription>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="show-emails" className="text-xs font-medium">
                  Zobrazit e-maily
                </Label>
                <Switch id="show-emails" checked={showEmails} onCheckedChange={setShowEmails} />
              </div>
            )}
          </div>
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
                    <TableHead>RLS politika</TableHead>
                    <TableHead>Větev pravidla</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibility.map((row) => (
                    <TableRow key={row.employee_id}>
                      <TableCell>{row.employee_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {displayEmail(row.employee_email)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={reasonVariant(row.reason)}>{row.reason}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <code className="rounded bg-muted px-1.5 py-0.5">{row.policy_name}</code>
                      </TableCell>
                      <TableCell className="text-xs">
                        <code className="rounded bg-muted px-1.5 py-0.5">{row.policy_branch}</code>
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Audit přístupu k zaměstnancům
              </CardTitle>
              <CardDescription>
                Posledních 500 záznamů o čtení tabulky zaměstnanců (kdo, role, kolik záznamů, jaký
                kontext). Použijte filtry pro vyhledání a tlačítko Export pro stažení CSV.
              </CardDescription>
            </div>
            <Button onClick={handleExportLogs} variant="outline" size="sm" className="gap-2" title={CSV_FORMAT_TOOLTIP}>
              <Download className="h-4 w-4" />
              Export ({filteredLogs.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="f-user" className="text-xs">Uživatel (e-mail)</Label>
              <Input
                id="f-user"
                placeholder="hledat…"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všechny</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="manager">manager</SelectItem>
                  <SelectItem value="user">user</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Akce</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všechny</SelectItem>
                  <SelectItem value="list">list</SelectItem>
                  <SelectItem value="detail">detail</SelectItem>
                  <SelectItem value="inactive_list">inactive_list</SelectItem>
                  <SelectItem value="export">export</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-from" className="text-xs">Od</Label>
              <Input id="f-from" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-to" className="text-xs">Do</Label>
              <Input id="f-to" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-5">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1">
                <X className="h-3.5 w-3.5" /> Vymazat filtry
              </Button>
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                {filteredLogs.length} z {logs.length} záznamů
              </div>
            </div>
          </div>

          {loadingLogs ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Žádné záznamy neodpovídají filtrům.</p>
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
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDisplayDateTime(log.created_at)}
                      </TableCell>
                      <TableCell>{displayEmail(log.user_email)}</TableCell>
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
