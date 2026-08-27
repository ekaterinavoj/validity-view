import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserOption {
  id: string;
  label: string;
  role: string;
}

interface DocRow {
  document_id: string;
  examination_id: string;
  file_name: string;
  file_path: string;
  uploaded_by: string | null;
  reason: string;
  policy_name: string;
  policy_branch: string;
}

const reasonVariant = (reason: string): "default" | "secondary" | "outline" | "destructive" => {
  if (reason.startsWith("admin")) return "default";
  if (reason.startsWith("manager")) return "secondary";
  if (reason.startsWith("denied")) return "destructive";
  return "outline";
};

export function MedicalDocsAccessDebug() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("approval_status", "approved")
        .order("last_name");
      if (!profiles) return;
      const enriched: UserOption[] = await Promise.all(
        profiles.map(async (p) => {
          const { data: roles } = await supabase.rpc("get_user_roles", { _user_id: p.id });
          const role = (roles ?? [])[0] ?? "user";
          return { id: p.id, label: `${p.last_name} ${p.first_name} (${p.email})`, role };
        })
      );
      setUsers(enriched);
    })();
  }, []);

  const run = async (userId: string) => {
    setSelectedUser(userId);
    if (!userId) {
      setRows([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("debug_medical_document_access" as never, {
      _target_user_id: userId,
    } as never);
    setLoading(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data ?? []) as unknown as DocRow[]);
  };

  if (!isAdmin) return null;

  const counts = rows.reduce(
    (acc, r) => {
      const key = r.reason.split(":")[0] as keyof typeof acc;
      if (key in acc) acc[key]++;
      return acc;
    },
    { admin: 0, self: 0, manager: 0, denied: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Debug přístupu k lékařským dokumentům
        </CardTitle>
        <CardDescription>
          U každého dokumentu vidíte konkrétní RLS větev, která uživateli povoluje (nebo zakazuje)
          přístup ke storage objektu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedUser} onValueChange={run}>
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
          {rows.length > 0 && (
            <>
              <Badge variant="default">admin: {counts.admin}</Badge>
              <Badge variant="outline">self: {counts.self}</Badge>
              <Badge variant="secondary">manager: {counts.manager}</Badge>
              <Badge variant="destructive">denied: {counts.denied}</Badge>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : selectedUser && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Žádné dokumenty nejsou v systému.</p>
        ) : rows.length > 0 ? (
          <ScrollArea className="max-h-[480px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Soubor</TableHead>
                  <TableHead>Důvod</TableHead>
                  <TableHead>Politika</TableHead>
                  <TableHead>Větev</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.document_id}>
                    <TableCell className="font-mono text-xs">{r.file_name}</TableCell>
                    <TableCell>
                      <Badge variant={reasonVariant(r.reason)}>{r.reason}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <code className="rounded bg-muted px-1.5 py-0.5">{r.policy_name}</code>
                    </TableCell>
                    <TableCell className="text-xs">
                      <code className="rounded bg-muted px-1.5 py-0.5">{r.policy_branch}</code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : null}
      </CardContent>
    </Card>
  );
}
