/**
 * ReminderSimulationPreview
 * --------------------------------------------------------------------
 * Admin tool: "Simulovat odeslání"
 *
 * Lets the admin pick a module (Školení / Technické lhůty / PLP) and a
 * reminder template, then renders a dry-run preview that shows:
 *   1. Which records fall inside the selected reminder window
 *   2. Per-recipient grouping (one card per recipient with the same
 *      {{records_table}} that the email function would render)
 *   3. Diagnostics for skipped records — i.e. records suppressed because
 *      a recent successful reminder log exists within `repeat_days_after`
 *
 * No emails are sent. No DB writes happen. The preview reads the same
 * settings (system_settings.reminder_recipients) and template that the
 * Edge Function uses, so what the admin sees == what would actually be
 * delivered.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  Users,
  PlayCircle,
  AlertCircle,
  CalendarClock,
  EyeOff,
  ChevronRight,
} from "lucide-react";

type ModuleKey = "trainings" | "deadlines" | "medical";

interface ModuleConfig {
  key: ModuleKey;
  label: string;
  templatesTable: "reminder_templates" | "deadline_reminder_templates" | "medical_reminder_templates";
  logsTable: "reminder_logs" | "deadline_reminder_logs" | "medical_reminder_logs";
  recordIdColumn: "training_id" | "deadline_id" | "examination_id";
  recipientsKey: string; // system_settings key for module recipients
  fetchRecords: () => Promise<RecordItem[]>;
}

interface RecordItem {
  id: string;
  remind_days_before: number | null;
  repeat_days_after: number | null;
  reminder_template_id: string | null;
  next_date: string;
  primary_label: string; // e.g. "Jan Novák — BOZP"
  secondary_label: string; // e.g. "Provozovna XY"
}

interface SimulationRow extends RecordItem {
  daysUntil: number;
  status: "include" | "skip_window" | "skip_recent_log";
  reason?: string;
  lastLogAt?: string;
}

interface RecipientGroup {
  email: string;
  name: string;
  rows: SimulationRow[];
}

const todayMidnight = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDateCs = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("cs-CZ");
};

export function ReminderSimulationPreview() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [moduleKey, setModuleKey] = useState<ModuleKey>("trainings");
  const [templateId, setTemplateId] = useState<string>("");
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; remind_days_before: number; repeat_interval_days: number | null; email_subject: string; email_body: string }>>([]);
  const [recipientEmails, setRecipientEmails] = useState<Array<{ email: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [simulationRows, setSimulationRows] = useState<SimulationRow[]>([]);

  const moduleConfig: Record<ModuleKey, ModuleConfig> = {
    trainings: {
      key: "trainings",
      label: "Školení",
      templatesTable: "reminder_templates",
      logsTable: "reminder_logs",
      recordIdColumn: "training_id",
      recipientsKey: "reminder_recipients",
      fetchRecords: async () => {
        const { data } = await supabase
          .from("trainings")
          .select(`
            id, next_training_date, remind_days_before, repeat_days_after, reminder_template_id,
            employees (first_name, last_name),
            training_types (name, facility)
          `)
          .eq("is_active", true)
          .is("deleted_at", null)
          .limit(5000);

        return (data || []).map((t: any) => ({
          id: t.id,
          remind_days_before: t.remind_days_before,
          repeat_days_after: t.repeat_days_after,
          reminder_template_id: t.reminder_template_id,
          next_date: t.next_training_date,
          primary_label: `${t.employees?.first_name ?? ""} ${t.employees?.last_name ?? ""} — ${t.training_types?.name ?? "—"}`.trim(),
          secondary_label: t.training_types?.facility ?? "",
        }));
      },
    },
    deadlines: {
      key: "deadlines",
      label: "Technické lhůty",
      templatesTable: "deadline_reminder_templates",
      logsTable: "deadline_reminder_logs",
      recordIdColumn: "deadline_id",
      recipientsKey: "deadline_reminder_recipients",
      fetchRecords: async () => {
        const { data } = await supabase
          .from("deadlines")
          .select(`
            id, next_check_date, remind_days_before, repeat_days_after, reminder_template_id,
            equipment (name, inventory_number),
            deadline_types (name, facility)
          `)
          .eq("is_active", true)
          .is("deleted_at", null)
          .limit(5000);

        return (data || []).map((d: any) => ({
          id: d.id,
          remind_days_before: d.remind_days_before,
          repeat_days_after: d.repeat_days_after,
          reminder_template_id: d.reminder_template_id,
          next_date: d.next_check_date,
          primary_label: `${d.equipment?.inventory_number ?? "—"} ${d.equipment?.name ?? ""} — ${d.deadline_types?.name ?? ""}`.trim(),
          secondary_label: d.deadline_types?.facility ?? "",
        }));
      },
    },
    medical: {
      key: "medical",
      label: "PLP (zdravotní prohlídky)",
      templatesTable: "medical_reminder_templates",
      logsTable: "medical_reminder_logs",
      recordIdColumn: "examination_id",
      recipientsKey: "medical_reminder_recipients",
      fetchRecords: async () => {
        const { data } = await supabase
          .from("medical_examinations")
          .select(`
            id, next_examination_date, remind_days_before, repeat_days_after, reminder_template_id,
            employees (first_name, last_name),
            medical_examination_types (name, facility)
          `)
          .eq("is_active", true)
          .is("deleted_at", null)
          .limit(5000);

        return (data || []).map((m: any) => ({
          id: m.id,
          remind_days_before: m.remind_days_before,
          repeat_days_after: m.repeat_days_after,
          reminder_template_id: m.reminder_template_id,
          next_date: m.next_examination_date,
          primary_label: `${m.employees?.first_name ?? ""} ${m.employees?.last_name ?? ""} — ${m.medical_examination_types?.name ?? ""}`.trim(),
          secondary_label: m.medical_examination_types?.facility ?? "",
        }));
      },
    },
  };

  const config = moduleConfig[moduleKey];

  // Load templates whenever module changes
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data, error } = await (supabase
        .from(config.templatesTable as any) as any)
        .select("id, name, remind_days_before, repeat_interval_days, email_subject, email_body")
        .eq("is_active", true)
        .order("name");
      if (error) {
        toast({ title: "Chyba načítání šablon", description: error.message, variant: "destructive" });
        return;
      }
      setTemplates((data || []) as any);
      setTemplateId((data?.[0]?.id as string) || "");
    })();
  }, [open, moduleKey]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId],
  );

  const runSimulation = async () => {
    if (!selectedTemplate) {
      toast({ title: "Vyberte šablonu", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // 1. Load module recipients from system_settings
      const { data: settings } = await supabase
        .from("system_settings")
        .select("key, value")
        .eq("key", config.recipientsKey)
        .maybeSingle();

      const recipientUserIds: string[] = (settings?.value as any)?.user_ids || [];
      let recips: Array<{ email: string; name: string }> = [];
      if (recipientUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name")
          .in("id", recipientUserIds);
        recips = (profiles || []).map((p) => ({
          email: p.email,
          name: `${p.first_name} ${p.last_name}`.trim(),
        }));
      }
      setRecipientEmails(recips);

      // 2. Load all active records for this module
      const records = await config.fetchRecords();

      // 3. Compute simulation rows: window check + recent-log diagnostics
      const today = todayMidnight();
      const cutoffByRecord = new Map<string, string>(); // recordId → ISO cutoff
      const rows: SimulationRow[] = [];

      // Check recent logs in batch (one query)
      const recordIds = records.map((r) => r.id);
      const earliestCutoff = new Date();
      earliestCutoff.setDate(earliestCutoff.getDate() - 365); // anything within last year is enough
      const { data: recentLogs } = await (supabase
        .from(config.logsTable as any) as any)
        .select(`id, ${config.recordIdColumn}, created_at, status`)
        .in(config.recordIdColumn, recordIds.length > 0 ? recordIds : ["00000000-0000-0000-0000-000000000000"])
        .eq("status", "sent")
        .eq("is_test", false)
        .gte("created_at", earliestCutoff.toISOString())
        .order("created_at", { ascending: false });

      // Map: recordId → latest log created_at
      const latestLogByRecord = new Map<string, string>();
      for (const log of (recentLogs || []) as any[]) {
        const rid = log[config.recordIdColumn];
        if (rid && !latestLogByRecord.has(rid)) {
          latestLogByRecord.set(rid, log.created_at);
        }
      }

      // Use template's remind_days_before as the simulation window when record has no override
      const windowDays = selectedTemplate.remind_days_before ?? 30;

      for (const rec of records) {
        const remindDays = rec.remind_days_before ?? windowDays;
        const repeatDays = rec.repeat_days_after ?? selectedTemplate.repeat_interval_days ?? 30;

        const next = new Date(rec.next_date);
        next.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Outside reminder window
        if (daysUntil > remindDays) {
          continue; // not relevant for the simulation — won't even appear
        }

        // Filter to records that match the SELECTED template:
        //  - record explicitly references this template, OR
        //  - record has no template and we treat selected as default
        const matchesTemplate =
          rec.reminder_template_id === selectedTemplate.id ||
          (rec.reminder_template_id == null);
        if (!matchesTemplate) continue;

        // Diagnostic: would idempotency suppress this?
        const lastLogAt = latestLogByRecord.get(rec.id);
        if (lastLogAt && repeatDays > 0) {
          const lastLogDate = new Date(lastLogAt);
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - repeatDays);
          if (lastLogDate >= cutoff) {
            rows.push({
              ...rec,
              daysUntil,
              status: "skip_recent_log",
              reason: `Přeskočeno – připomínka odeslána ${formatDateCs(lastLogAt)} (repeat_days_after = ${repeatDays})`,
              lastLogAt,
            });
            continue;
          }
        }

        rows.push({
          ...rec,
          daysUntil,
          status: "include",
        });
      }

      setSimulationRows(rows);
    } catch (err: any) {
      toast({ title: "Chyba při simulaci", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Per-recipient grouping: every module recipient sees the same merged digest
  const recipientGroups: RecipientGroup[] = useMemo(() => {
    const includedRows = simulationRows.filter((r) => r.status === "include");
    if (recipientEmails.length === 0 || includedRows.length === 0) return [];
    return recipientEmails.map((rec) => ({
      email: rec.email,
      name: rec.name,
      rows: includedRows,
    }));
  }, [recipientEmails, simulationRows]);

  const skippedRows = useMemo(
    () => simulationRows.filter((r) => r.status !== "include"),
    [simulationRows],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <PlayCircle className="w-4 h-4 mr-2" />
          Simulovat odeslání připomínek
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5" />
            Simulace odeslání připomínek
          </DialogTitle>
          <DialogDescription>
            Vyberte modul a šablonu. Zobrazí se náhled e-mailů včetně{" "}
            <code className="text-xs">{`{{records_table}}`}</code> per příjemce a diagnostika
            přeskočených záznamů. Žádné e-maily se reálně neodešlou.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Modul</Label>
            <Select value={moduleKey} onValueChange={(v) => setModuleKey(v as ModuleKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trainings">Školení</SelectItem>
                <SelectItem value="deadlines">Technické lhůty</SelectItem>
                <SelectItem value="medical">PLP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Šablona</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Vyberte šablonu…" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.remind_days_before} dnů)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={runSimulation} disabled={loading || !templateId} className="w-full">
              {loading ? "Načítání…" : "Spustit simulaci"}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 pr-3">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!loading && simulationRows.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground border rounded-md mt-4">
              Spusťte simulaci pro zobrazení náhledu.
            </div>
          )}

          {!loading && recipientGroups.length === 0 && simulationRows.filter(r => r.status === "include").length > 0 && (
            <Card className="mt-4">
              <CardContent className="pt-4 flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium">Pro tento modul nejsou nastaveni žádní příjemci.</p>
                  <p className="text-muted-foreground text-xs">
                    Záznamy spadají do okna, ale e-mail nebude odeslán. Doplňte příjemce
                    v Administraci → Připomínky.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary bar */}
          {!loading && simulationRows.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 mb-3">
              <Badge variant="default" className="gap-1">
                <Users className="w-3 h-3" />
                {recipientGroups.length} příjemců
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <CalendarClock className="w-3 h-3" />
                {simulationRows.filter((r) => r.status === "include").length} záznamů v tabulce
              </Badge>
              {skippedRows.length > 0 && (
                <Badge variant="outline" className="gap-1">
                  <EyeOff className="w-3 h-3" />
                  {skippedRows.length} přeskočeno
                </Badge>
              )}
            </div>
          )}

          {/* Per-recipient digest cards */}
          {recipientGroups.map((group) => (
            <Card key={group.email} className="mt-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {group.name} <span className="text-muted-foreground text-sm font-normal">&lt;{group.email}&gt;</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">
                  Předmět:{" "}
                  <span className="font-medium text-foreground">
                    {selectedTemplate?.email_subject || "—"}
                  </span>
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Záznam</TableHead>
                      <TableHead>Provozovna</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="text-center">Dnů</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.primary_label}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.secondary_label}</TableCell>
                        <TableCell className="text-sm">{formatDateCs(r.next_date)}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={r.daysUntil < 0 ? "destructive" : r.daysUntil <= 7 ? "default" : "secondary"}
                          >
                            {r.daysUntil < 0 ? `${Math.abs(r.daysUntil)} po termínu` : `${r.daysUntil}`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          {/* Skipped diagnostics */}
          {skippedRows.length > 0 && (
            <Card className="mt-4 border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <EyeOff className="w-4 h-4" />
                  Přeskočené záznamy
                  <Badge variant="outline">{skippedRows.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Záznam</TableHead>
                      <TableHead>Důvod</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skippedRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">
                          <ChevronRight className="inline w-3 h-3 mr-1 text-muted-foreground" />
                          {r.primary_label}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
