import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEmployees } from "@/hooks/useEmployees";
import { ProbationBadge } from "@/components/ProbationBadge";
import { DepartmentCell } from "@/components/DepartmentCell";
import { Search, X, ClipboardList, Bell, Info, Download, FileText, History, LayoutList, Layers, HelpCircle, ExternalLink } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { formatDisplayDate } from "@/lib/dateFormat";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { exportToCSV } from "@/lib/csvExport";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type WindowFilter = "ending_14" | "ending_30" | "ending_60" | "all_active";

function daysUntil(end: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(end);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

const FIELD_LABELS: Record<string, string> = {
  start_date: "Datum nástupu",
  probation_months: "Délka ZD (měs.)",
  probation_end_date: "Konec ZD",
  probation_override_reason: "Důvod úpravy",
  date_from: "Datum od",
  date_to: "Datum do",
  reason: "Důvod překážky",
};

function formatAuditValue(field: string, value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field.includes("date")) return formatDisplayDate(String(value));
  return String(value);
}

interface AuditEntry {
  id: string;
  created_at: string;
  table_name: string;
  record_id: string;
  action: string;
  changed_fields: string[] | null;
  old_data: any;
  new_data: any;
  user_name: string | null;
  user_email: string | null;
}

export default function Probations() {
  const { employees, loading, error } = useEmployees();
  const { toast } = useToast();
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("ending_30");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"list" | "history">("list");
  // Compact mode = jen přehled bez záložek (uloženo v localStorage)
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("probations-compact-mode") === "1";
  });
  const toggleCompact = (next: boolean) => {
    setCompactMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("probations-compact-mode", next ? "1" : "0");
    }
    if (next) setTab("list");
  };
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return employees
      .filter((e) => e.status === "employed" && e.probationEndDate)
      .filter((e) => {
        const days = daysUntil(e.probationEndDate!);
        if (windowFilter === "ending_14") return days >= 0 && days <= 14;
        if (windowFilter === "ending_30") return days >= 0 && days <= 30;
        if (windowFilter === "ending_60") return days >= 0 && days <= 60;
        return true;
      })
      .filter((e) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          (e.employeeNumber || "").toLowerCase().includes(q) ||
          (e.position || "").toLowerCase().includes(q) ||
          (e.email || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => daysUntil(a.probationEndDate!) - daysUntil(b.probationEndDate!));
  }, [employees, windowFilter, search]);

  const hasFilters = search !== "" || windowFilter !== "ending_30";

  // Build employee lookup for history tab (audit logs reference employee_id via record_id for employees_probation)
  const employeeMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, `${e.firstName} ${e.lastName}`));
    return m;
  }, [employees]);

  // Load audit history when switching tab
  useEffect(() => {
    if (tab !== "history") return;
    let cancelled = false;
    (async () => {
      setAuditLoading(true);
      setAuditError(null);
      try {
        const { data, error: err } = await supabase
          .from("audit_logs")
          .select("*")
          .in("table_name", ["employees_probation", "probation_obstacles"])
          .order("created_at", { ascending: false })
          .limit(500);
        if (err) throw err;
        if (!cancelled) setAuditEntries((data as AuditEntry[]) || []);
      } catch (e: any) {
        if (!cancelled) setAuditError(e.message ?? "Nepodařilo se načíst historii.");
      } finally {
        if (!cancelled) setAuditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const exportRows = filtered.map((e) => ({
    "Os. číslo": e.employeeNumber || "",
    "Jméno": `${e.firstName} ${e.lastName}`,
    "Pozice": e.position || "",
    "Středisko": e.departmentName ? `${e.department || ""} - ${e.departmentName}` : (e.department || ""),
    "Datum nástupu": e.startDate ? formatDisplayDate(e.startDate) : "",
    "Délka (měs.)": e.probationMonths ?? "",
    "Konec ZD": e.probationEndDate ? formatDisplayDate(e.probationEndDate) : "",
    "Dní do konce": e.probationEndDate ? daysUntil(e.probationEndDate) : "",
    "Nadřízený": e.managerFirstName || e.managerLastName ? `${e.managerFirstName || ""} ${e.managerLastName || ""}`.trim() : "",
    "Důvod úpravy": e.probationOverrideReason || "",
  }));

  const filterLabel: Record<WindowFilter, string> = {
    ending_14: "do-14-dni",
    ending_30: "do-30-dni",
    ending_60: "do-60-dni",
    all_active: "vsichni",
  };

  const handleCsvExport = () => {
    if (exportRows.length === 0) {
      toast({ title: "Není co exportovat", variant: "destructive" });
      return;
    }
    try {
      exportToCSV({
        filename: `zkusebni-doby_${filterLabel[windowFilter]}_${new Date().toISOString().slice(0, 10)}`,
        data: exportRows,
      });
    } catch (e: any) {
      toast({ title: "Chyba exportu", description: e.message, variant: "destructive" });
    }
  };

  const handlePdfExport = () => {
    if (exportRows.length === 0) {
      toast({ title: "Není co exportovat", variant: "destructive" });
      return;
    }
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Zkušební doby", 40, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const labelMap: Record<WindowFilter, string> = {
      ending_14: "Konec do 14 dní",
      ending_30: "Konec do 30 dní",
      ending_60: "Konec do 60 dní",
      all_active: "Všichni aktivní v ZD",
    };
    doc.text(`Filtr: ${labelMap[windowFilter]} • Celkem: ${exportRows.length}`, 40, 58);

    const head = [Object.keys(exportRows[0])];
    const body = exportRows.map((r) => Object.values(r).map((v) => String(v ?? "")));
    autoTable(doc, {
      head,
      body,
      startY: 75,
      styles: { font: "helvetica", fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [0, 123, 194] },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(
          `${new Date().toLocaleString("cs-CZ")} • Strana ${data.pageNumber}/${pageCount}`,
          40,
          doc.internal.pageSize.getHeight() - 20,
        );
      },
    });
    doc.save(`zkusebni-doby_${filterLabel[windowFilter]}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (loading) return <TableSkeleton columns={8} />;
  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ClipboardList}
        title="Zkušební doby"
        description={
          <>
            Přehled aktivních zaměstnanců s blížícím se koncem zkušební doby.{" "}
            <Bell className="inline h-3.5 w-3.5 mb-0.5" /> In-app notifikace ve zvonečku se generují{" "}
            <strong>14 dní před koncem</strong> a <strong>v den konce</strong> pro administrátory a přímého
            nadřízeného.
          </>
        }
        actions={
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  pressed={compactMode}
                  onPressedChange={toggleCompact}
                  aria-label="Přepnout zobrazení bez záložek"
                  size="sm"
                  variant="outline"
                  className="h-9"
                >
                  {compactMode ? <LayoutList className="h-4 w-4 mr-1" /> : <Layers className="h-4 w-4 mr-1" />}
                  <span className="text-xs">{compactMode ? "Jen přehled" : "S historií"}</span>
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                {compactMode
                  ? "Záložka Historie změn je skrytá. Klikněte pro obnovení obou záložek."
                  : "Skrýt záložku Historie změn pro rychlé použití."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        }
      />

      <Tabs value={compactMode ? "list" : tab} onValueChange={(v) => setTab(v as "list" | "history")}>
        {!compactMode && (
          <TabsList>
            <TabsTrigger value="list">
              <ClipboardList className="h-4 w-4 mr-1" /> Přehled
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" /> Historie změn
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="list" className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Hledat (jméno, číslo, pozice, email)..."
                  className="pl-8"
                />
              </div>
              <Select value={windowFilter} onValueChange={(v) => setWindowFilter(v as WindowFilter)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ending_14">Končí do 14 dní</SelectItem>
                  <SelectItem value="ending_30">Končí do 30 dní</SelectItem>
                  <SelectItem value="ending_60">Končí do 60 dní</SelectItem>
                  <SelectItem value="all_active">Všichni aktivní v ZD</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setWindowFilter("ending_30");
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Vyčistit
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={handleCsvExport}>
                  <Download className="h-4 w-4 mr-1" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handlePdfExport}>
                  <FileText className="h-4 w-4 mr-1" /> PDF
                </Button>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  Celkem: {filtered.length}
                </span>
              </div>
            </div>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Os. číslo</TableHead>
                  <TableHead>Jméno</TableHead>
                  <TableHead>Pozice</TableHead>
                  <TableHead>Středisko</TableHead>
                  <TableHead>Datum nástupu</TableHead>
                  <TableHead>Délka (měs.)</TableHead>
                  <TableHead>Konec ZD</TableHead>
                  <TableHead>Nadřízený</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0">
                      <EmptyState
                        icon={ClipboardList}
                        title="Žádní zaměstnanci v tomto okně"
                        description="Zkuste změnit filtr nebo vyhledávací kritéria."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.employeeNumber || "-"}</TableCell>
                      <TableCell>
                        {e.firstName} {e.lastName}
                      </TableCell>
                      <TableCell className="text-sm">{e.position}</TableCell>
                      <TableCell className="text-sm">
                        <DepartmentCell code={e.department} name={e.departmentName} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.startDate ? formatDisplayDate(e.startDate) : "-"}
                      </TableCell>
                      <TableCell className="text-center text-sm">{e.probationMonths ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ProbationBadge endDate={e.probationEndDate} />
                          {e.probationOverrideReason && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-status-warning cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs font-medium mb-1">Ručně upraveno – důvod:</p>
                                  <p className="text-xs">{e.probationOverrideReason}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.managerFirstName || e.managerLastName
                          ? `${e.managerFirstName || ""} ${e.managerLastName || ""}`.trim()
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Audit log všech změn zkušební doby (datum nástupu, délka, konec ZD, důvod úpravy) a překážek v práci.
              Zobrazeno posledních 500 záznamů.
            </p>
          </Card>

          <Card>
            {auditLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Načítání…</div>
            ) : auditError ? (
              <div className="p-6">
                <ErrorDisplay message={auditError} />
              </div>
            ) : auditEntries.length === 0 ? (
              <EmptyState
                icon={History}
                title="Žádné záznamy v historii"
                description="Změny zkušební doby a překážek se zobrazí zde."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Kdy</TableHead>
                    <TableHead className="w-[120px]">Akce</TableHead>
                    <TableHead className="w-[180px]">Zaměstnanec</TableHead>
                    <TableHead>Změny</TableHead>
                    <TableHead className="w-[180px]">Kdo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditEntries.map((entry) => {
                    // pro probation_obstacles je record_id = obstacle id, employee_id je v old/new_data
                    const employeeId =
                      entry.table_name === "employees_probation"
                        ? entry.record_id
                        : (entry.new_data?.employee_id ?? entry.old_data?.employee_id);
                    const employeeName = employeeId ? employeeMap.get(employeeId) ?? "—" : "—";
                    const actionLabel =
                      entry.table_name === "probation_obstacles"
                        ? entry.action === "INSERT"
                          ? "Překážka přidána"
                          : entry.action === "DELETE"
                            ? "Překážka smazána"
                            : "Překážka upravena"
                        : "Změna ZD";
                    const fields = (entry.changed_fields || []).filter((f) =>
                      entry.table_name === "employees_probation"
                        ? ["start_date", "probation_months", "probation_end_date", "probation_override_reason"].includes(f)
                        : true,
                    );
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleString("cs-CZ")}
                        </TableCell>
                        <TableCell className="text-xs">{actionLabel}</TableCell>
                        <TableCell className="text-sm">{employeeName}</TableCell>
                        <TableCell className="text-xs">
                          {fields.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {fields.map((f) => (
                                <li key={f}>
                                  <span className="font-medium">{FIELD_LABELS[f] ?? f}:</span>{" "}
                                  <span className="text-muted-foreground">
                                    {formatAuditValue(f, entry.old_data?.[f])}
                                  </span>{" "}
                                  →{" "}
                                  <span>{formatAuditValue(f, entry.new_data?.[f])}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {entry.user_name || entry.user_email || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
