import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Eye, Download, Filter, X, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDateTime } from "@/lib/dateFormat";
import { exportToCSV } from "@/lib/csvExport";
import { buildExportFilename, CSV_FORMAT_TOOLTIP } from "@/lib/exportFilename";

interface Row {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  target_user_id: string | null;
  changed_fields: string[] | null;
  created_at: string;
  actor_role: string | null;
  total_count: number;
}

const PAGE_SIZE = 200;

const maskEmail = (email: string | null | undefined): string => {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}${"*".repeat(Math.max(3, local.length - 1))}@${domain}`;
};

export function SecurityAuditPanel() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [showEmails, setShowEmails] = useState(false);

  const [fUser, setFUser] = useState("");
  const [fTarget, setFTarget] = useState("");
  const [fRole, setFRole] = useState<string>("all");
  const [fAction, setFAction] = useState("");
  const [fTable, setFTable] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params: Record<string, unknown> = {
      _user_id: null,
      _target_user_id: fTarget || null,
      _role: fRole === "all" ? null : fRole,
      _action: fAction || null,
      _table_name: fTable || null,
      _from: fFrom ? new Date(fFrom).toISOString() : null,
      _to: fTo ? new Date(`${fTo}T23:59:59.999Z`).toISOString() : null,
      _limit: PAGE_SIZE,
      _offset: 0,
    };
    const { data, error } = await supabase.rpc("get_filtered_audit_logs" as never, params as never);
    setLoading(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    let list = (data ?? []) as unknown as Row[];
    if (fUser.trim()) {
      const q = fUser.trim().toLowerCase();
      list = list.filter((r) => (r.user_email ?? "").toLowerCase().includes(q));
    }
    setRows(list);
    setTotal(list[0]?.total_count ?? list.length);
  }, [fUser, fTarget, fRole, fAction, fTable, fFrom, fTo, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const reset = () => {
    setFUser("");
    setFTarget("");
    setFRole("all");
    setFAction("");
    setFTable("");
    setFFrom("");
    setFTo("");
  };

  const display = (e: string | null | undefined) =>
    isAdmin && showEmails ? e ?? "—" : maskEmail(e);

  const handleExport = () => {
    if (rows.length === 0) {
      toast({ title: "Nic k exportu", variant: "destructive" });
      return;
    }
    exportToCSV({
      filename: buildExportFilename("audit-log"),
      data: rows.map((r) => ({
        cas: formatDisplayDateTime(r.created_at),
        akce: r.action,
        tabulka: r.table_name,
        uzivatel: r.user_email ?? "",
        role: r.actor_role ?? "",
        cilovy_uzivatel: r.target_user_id ?? "",
        zaznam: r.record_id,
        zmenena_pole: (r.changed_fields ?? []).join(","),
      })),
    });
    toast({ title: "Export hotov", description: `Exportováno ${rows.length} záznamů` });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Audit logy (server-side filtr)
            </CardTitle>
            <CardDescription>
              Filtry se aplikují přímo v SQL RPC. Sloupce „Uživatel“ a „Cílový uživatel“ rozlišují
              kdo akci spustil a koho se týkala.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="aud-show-emails" className="text-xs font-medium">
                  Zobrazit e-maily
                </Label>
                <Switch
                  id="aud-show-emails"
                  checked={showEmails}
                  onCheckedChange={setShowEmails}
                />
              </div>
            )}
            <Button onClick={handleExport} variant="outline" size="sm" className="gap-2" title={CSV_FORMAT_TOOLTIP}>
              <Download className="h-4 w-4" /> Export ({rows.length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Uživatel (e-mail obsahuje)</Label>
            <Input value={fUser} onChange={(e) => setFUser(e.target.value)} placeholder="hledat…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cílový uživatel (UUID)</Label>
            <Input value={fTarget} onChange={(e) => setFTarget(e.target.value)} placeholder="uuid…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Select value={fRole} onValueChange={setFRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="manager">manager</SelectItem>
                <SelectItem value="user">user</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Akce (přesně)</Label>
            <Input value={fAction} onChange={(e) => setFAction(e.target.value)} placeholder="UPDATE, USER_APPROVED…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tabulka</Label>
            <Input value={fTable} onChange={(e) => setFTable(e.target.value)} placeholder="user_roles…" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Od</Label>
            <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Do</Label>
            <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />}
              Aplikovat
            </Button>
            <Button size="sm" variant="ghost" onClick={reset} className="gap-1">
              <X className="h-3.5 w-3.5" /> Vymazat
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Zobrazeno {rows.length} záznamů (server vrátil celkem {total}). Zvyšte přesnost filtrů
          pro užší výběr.
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné záznamy neodpovídají filtrům.</p>
        ) : (
          <ScrollArea className="max-h-[520px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Čas</TableHead>
                  <TableHead>Akce</TableHead>
                  <TableHead>Tabulka</TableHead>
                  <TableHead>Uživatel</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Cílový uživatel</TableHead>
                  <TableHead>Záznam</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDisplayDateTime(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.action}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.table_name}</TableCell>
                    <TableCell className="text-xs">{display(r.user_email)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.actor_role ?? "?"}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {r.target_user_id ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {r.record_id}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
