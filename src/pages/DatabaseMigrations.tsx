import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Database,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  RefreshCw,
  Plus,
  ArrowLeft,
} from "lucide-react";
import {
  MIGRATION_REGISTRY,
  getPendingMigrations,
  type MigrationEntry,
} from "@/lib/migrationRegistry";

interface AppliedMigration {
  version: string;
  name: string;
  applied_at: string;
}

interface ApplyResult {
  version: string;
  name: string;
  status: "applied" | "skipped" | "error";
  error?: string;
}

export default function DatabaseMigrations() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [appliedMigrations, setAppliedMigrations] = useState<AppliedMigration[]>([]);
  const [results, setResults] = useState<ApplyResult[]>([]);

  // Manual migration form
  const [manualVersion, setManualVersion] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualSql, setManualSql] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    loadStatus();
  }, [isAdmin]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("apply-migrations", {
        body: { action: "status" },
      });

      if (error) throw error;
      setAppliedMigrations(data.applied || []);
    } catch (err: any) {
      toast({
        title: "Chyba při načítání stavu migrací",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const appliedVersions = new Set(appliedMigrations.map((m) => m.version));
  const pendingMigrations = getPendingMigrations(appliedVersions);

  // All registry entries with status
  const allMigrations = MIGRATION_REGISTRY.map((m) => ({
    ...m,
    isApplied: appliedVersions.has(m.version),
    appliedAt: appliedMigrations.find((a) => a.version === m.version)?.applied_at,
  }));

  // Unknown applied migrations (applied but not in registry)
  const registryVersions = new Set(MIGRATION_REGISTRY.map((m) => m.version));
  const unknownApplied = appliedMigrations.filter(
    (m) => !registryVersions.has(m.version)
  );

  const handleApplyPending = async () => {
    if (pendingMigrations.length === 0) return;

    setApplying(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("apply-migrations", {
        body: {
          action: "apply",
          migrations: pendingMigrations.map((m) => ({
            version: m.version,
            name: m.name,
            sql: m.sql,
          })),
        },
      });

      if (error) throw error;
      setResults(data.results || []);

      const applied = (data.results || []).filter(
        (r: ApplyResult) => r.status === "applied"
      ).length;
      const errors = (data.results || []).filter(
        (r: ApplyResult) => r.status === "error"
      ).length;

      toast({
        title: errors > 0 ? "Migrace dokončeny s chybami" : "Migrace úspěšně aplikovány",
        description: `Aplikováno: ${applied}, Přeskočeno: ${
          (data.results || []).filter((r: ApplyResult) => r.status === "skipped").length
        }, Chyby: ${errors}`,
        variant: errors > 0 ? "destructive" : "default",
      });

      await loadStatus();
    } catch (err: any) {
      toast({
        title: "Chyba při aplikaci migrací",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const handleApplyManual = async () => {
    if (!manualVersion || !manualName || !manualSql) {
      toast({
        title: "Vyplňte všechna pole",
        variant: "destructive",
      });
      return;
    }

    setApplying(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("apply-migrations", {
        body: {
          action: "apply",
          migrations: [
            { version: manualVersion, name: manualName, sql: manualSql },
          ],
        },
      });

      if (error) throw error;
      setResults(data.results || []);

      const result = data.results?.[0];
      toast({
        title:
          result?.status === "applied"
            ? "Migrace úspěšně aplikována"
            : result?.status === "error"
            ? "Chyba při aplikaci"
            : "Migrace přeskočena",
        description: result?.error || `Verze: ${manualVersion}`,
        variant: result?.status === "error" ? "destructive" : "default",
      });

      if (result?.status === "applied") {
        setManualVersion("");
        setManualName("");
        setManualSql("");
        setShowManualForm(false);
      }

      await loadStatus();
    } catch (err: any) {
      toast({
        title: "Chyba při aplikaci migrace",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/settings")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Database className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-3xl font-bold text-foreground">Databázové migrace</h2>
            <p className="text-muted-foreground">
              Správa a aplikace databázových migrací
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadStatus} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowManualForm(!showManualForm)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Manuální migrace
          </Button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Celkem v registru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{MIGRATION_REGISTRY.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aplikované
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {appliedMigrations.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Čekající
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {pendingMigrations.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Migrations */}
      {pendingMigrations.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Clock className="w-5 h-5" />
              Čekající migrace ({pendingMigrations.length})
            </CardTitle>
            <CardDescription>
              Tyto migrace ještě nebyly aplikovány na databázi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingMigrations.map((m) => (
              <div
                key={m.version}
                className="flex items-center justify-between p-3 bg-background rounded-lg border"
              >
                <div>
                  <span className="font-mono text-sm text-muted-foreground">
                    {m.version}
                  </span>
                  <span className="ml-3 font-medium">{m.name}</span>
                </div>
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  Čeká
                </Badge>
              </div>
            ))}
            <Separator />
            <Button
              onClick={handleApplyPending}
              disabled={applying}
              className="w-full"
            >
              {applying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Aplikovat všechny čekající migrace
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Výsledky poslední aplikace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r) => (
              <div
                key={r.version}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <span className="font-mono text-sm text-muted-foreground">
                    {r.version}
                  </span>
                  <span className="ml-3 font-medium">{r.name}</span>
                  {r.error && (
                    <p className="text-sm text-destructive mt-1">{r.error}</p>
                  )}
                </div>
                <Badge
                  variant={
                    r.status === "applied"
                      ? "default"
                      : r.status === "error"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {r.status === "applied"
                    ? "Aplikováno"
                    : r.status === "error"
                    ? "Chyba"
                    : "Přeskočeno"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Manual Migration Form */}
      {showManualForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Manuální migrace
            </CardTitle>
            <CardDescription>
              Zadejte SQL migrace ručně. Používejte pro ad-hoc změny nebo migrace
              z externích zdrojů.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="version">Verze (timestamp)</Label>
                <Input
                  id="version"
                  placeholder="20260301120000"
                  value={manualVersion}
                  onChange={(e) => setManualVersion(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Název</Label>
                <Input
                  id="name"
                  placeholder="add_new_feature"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sql">SQL</Label>
              <Textarea
                id="sql"
                placeholder="ALTER TABLE ..."
                value={manualSql}
                onChange={(e) => setManualSql(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            </div>
            <Button
              onClick={handleApplyManual}
              disabled={applying || !manualVersion || !manualName || !manualSql}
            >
              {applying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Aplikovat manuální migraci
            </Button>
          </CardContent>
        </Card>
      )}

      {/* All Migrations List */}
      <Card>
        <CardHeader>
          <CardTitle>Všechny migrace</CardTitle>
          <CardDescription>
            Kompletní přehled všech registrovaných migrací a jejich stavu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-1">
              {allMigrations.map((m) => (
                <div
                  key={m.version}
                  className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {m.isApplied ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : m.sql === null ? (
                      <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {m.version}
                      </span>
                      <span className="ml-2 text-sm">{m.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.sql === null && !m.isApplied && (
                      <Badge variant="outline" className="text-xs">
                        init-db.sql
                      </Badge>
                    )}
                    {m.isApplied && m.appliedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.appliedAt).toLocaleDateString("cs-CZ")}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Unknown applied migrations */}
              {unknownApplied.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <p className="text-sm text-muted-foreground px-3 pb-2">
                    Migrace aplikované mimo registr:
                  </p>
                  {unknownApplied.map((m) => (
                    <div
                      key={m.version}
                      className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                        <div>
                          <span className="font-mono text-xs text-muted-foreground">
                            {m.version}
                          </span>
                          <span className="ml-2 text-sm">{m.name}</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.applied_at).toLocaleDateString("cs-CZ")}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
