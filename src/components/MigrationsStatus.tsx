import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { MIGRATION_REGISTRY } from "@/lib/migrationRegistry";
import { formatDisplayDateTime } from "@/lib/dateFormat";

interface AppliedMigration {
  version: string;
  name: string;
  applied_at: string;
}

export function MigrationsStatus() {
  const [applied, setApplied] = useState<AppliedMigration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("schema_migrations")
        .select("version, name, applied_at")
        .order("applied_at", { ascending: false });
      setApplied((data ?? []) as AppliedMigration[]);
      setLoading(false);
    })();
  }, []);

  const appliedSet = new Set(applied.map((m) => m.version));
  const missing = MIGRATION_REGISTRY.filter((m) => m.sql !== null && !appliedSet.has(m.version));
  const last = applied[0];
  const total = MIGRATION_REGISTRY.length;
  const appliedCount = applied.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Stav migrací databáze
        </CardTitle>
        <CardDescription>
          Přehled všech registrovaných migrací, naposledy aplikovaná a chybějící (pro self-hosted).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Aplikováno</div>
                <div className="text-lg font-semibold">
                  {appliedCount} / {total}
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Poslední migrace</div>
                <div className="font-mono text-sm">{last?.version ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {last ? formatDisplayDateTime(last.applied_at) : ""}
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Chybějící (registr → DB)</div>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  {missing.length === 0 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 0
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600" /> {missing.length}
                    </>
                  )}
                </div>
              </div>
            </div>

            {missing.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Chybějící migrace</div>
                <ScrollArea className="max-h-[200px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Verze</TableHead>
                        <TableHead>Název</TableHead>
                        <TableHead>Stav</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {missing.map((m) => (
                        <TableRow key={m.version}>
                          <TableCell className="font-mono text-xs">{m.version}</TableCell>
                          <TableCell>{m.name}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">chybí</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium">Aplikované migrace ({appliedCount})</div>
              <ScrollArea className="max-h-[360px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Verze</TableHead>
                      <TableHead>Název</TableHead>
                      <TableHead>Aplikováno</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applied.map((m) => (
                      <TableRow key={m.version}>
                        <TableCell className="font-mono text-xs">{m.version}</TableCell>
                        <TableCell>{m.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDisplayDateTime(m.applied_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
