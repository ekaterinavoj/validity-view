import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEmployees } from "@/hooks/useEmployees";
import { ProbationBadge } from "@/components/ProbationBadge";
import { DepartmentCell } from "@/components/DepartmentCell";
import { Search, X, ClipboardList, Bell, Info, Download, FileText, History, LayoutList, Layers, HelpCircle, ExternalLink, Edit } from "lucide-react";
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
import { TablePagination } from "@/components/TablePagination";
import { usePagination } from "@/hooks/usePagination";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { buildExportFilename, CSV_FORMAT_TOOLTIP } from "@/lib/exportFilename";
import { cn } from "@/lib/utils";

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
  const navigate = useNavigate();
  const { preferences, updatePreference, isLoaded: prefsLoaded } = useUserPreferences();
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("all_active");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"list" | "history">("list");

  const goToEmployeeProbation = (employeeId: string) => {
    navigate(`/employees?edit=${employeeId}&focus=probation`);
  };

  // Compact mode = jen přehled bez záložek. Source of truth: user_preferences (DB),
  // s localStorage cache pro rychlou hydrataci. Synced napříč zařízeními.
  const compactMode = preferences.probationsCompactMode;
  const toggleCompact = (next: boolean) => {
    updatePreference("probationsCompactMode", next);
    if (next) setTab("list"); // vynuť přehled, abychom neviseli na skryté záložce
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

  // Souhrnné metriky pro banner – vždy z plné množiny aktivních zaměstnanců v ZD
  // (nezávislé na aktivním filtru okna / vyhledávání), aby uživatel viděl reálný stav.
  const allActiveInProbation = useMemo(
    () => employees.filter((e) => e.status === "employed" && e.probationEndDate && daysUntil(e.probationEndDate!) >= 0),
    [employees],
  );
  const stats = useMemo(() => {
    let urgent7 = 0;
    let upcoming14 = 0;
    let upcoming30 = 0;
    for (const e of allActiveInProbation) {
      const d = daysUntil(e.probationEndDate!);
      if (d <= 7) urgent7++;
      else if (d <= 14) upcoming14++;
      else if (d <= 30) upcoming30++;
    }
    return { urgent7, upcoming14, upcoming30, total: allActiveInProbation.length };
  }, [allActiveInProbation]);

  const PAGE_SIZE = 25;
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems } = usePagination(filtered, PAGE_SIZE);

  const hasFilters = search !== "" || windowFilter !== "all_active";

  // Build employee lookup for history tab (audit logs reference employee_id via record_id for employees_probation)
  const employeeMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, `${e.firstName} ${e.lastName}`));
    return m;
  }, [employees]);

  // Load audit history ONLY when:
  //   • user prefs are loaded (we know whether compact mode is on),
  //   • compact mode is OFF (history tab is rendered),
  //   • the active tab is "history".
  // → V kompaktním režimu se dotaz na audit_logs vůbec neprovede (úspora backendu).
  useEffect(() => {
    if (!prefsLoaded) return;
    if (compactMode) return;
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
  }, [tab, compactMode, prefsLoaded]);

  // Když uživatel přepne do compact módu po načtení historie, vyčistíme stav, aby
  // se v paměti netáhly už nepotřebné záznamy.
  useEffect(() => {
    if (compactMode && auditEntries.length > 0) {
      setAuditEntries([]);
    }
  }, [compactMode, auditEntries.length]);

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
        filename: buildExportFilename(`zkusebni-doby-${filterLabel[windowFilter]}`),
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
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <HelpCircle className="h-4 w-4 mr-1" />
                    <span className="text-xs">Kde najdu ZD?</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 text-sm">
                  <p className="font-medium mb-2">Kde se nastavuje zkušební doba</p>
                  <ol className="space-y-1.5 list-decimal list-inside text-muted-foreground">
                    <li>
                      Otevřete <strong>Správa dat → Zaměstnanci</strong>.
                    </li>
                    <li>
                      U konkrétního zaměstnance klikněte na ikonu <strong>úpravy</strong>.
                    </li>
                    <li>
                      Najděte sekci <strong>„Zkušební doba“</strong> – pole{" "}
                      <em>Datum nástupu</em>, <em>Délka (měsíce)</em> a <em>Konec ZD (přepsat)</em>.
                    </li>
                    <li>
                      Při ručním přepsání se objeví povinné pole{" "}
                      <strong>„Důvod úpravy konce ZD“</strong>.
                    </li>
                    <li>
                      Sekce <strong>„Celodenní překážky v práci“</strong> automaticky prodlužuje konec ZD.
                    </li>
                  </ol>
                  <p className="text-[11px] text-muted-foreground mt-2 mb-2 italic">
                    Tip: Klikněte na řádek v přehledu níže – otevře se editace zaměstnance přímo na sekci ZD.
                  </p>
                  <Button asChild size="sm" className="w-full">
                    <Link to="/employees">
                      <ExternalLink className="h-4 w-4 mr-1" /> Otevřít Zaměstnance
                    </Link>
                  </Button>
                </PopoverContent>
              </Popover>
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
                    ? "Záložka Historie změn je skrytá (a backend dotaz se neprovádí). Kliknutím obnovíte."
                    : "Skrýt Historii změn – v compact módu se vůbec nedotazuje audit log."}
                </TooltipContent>
              </Tooltip>
            </div>
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
          {/* Souhrnný banner – aktuální stav, klikatelné karty nastavují odpovídající filtr okna */}
          {stats.total > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setWindowFilter("all_active")}
                className="flex flex-col items-start rounded-md border border-border bg-card hover:bg-muted/40 transition-colors p-3 text-left"
              >
                <span className="text-2xl font-bold">{stats.total}</span>
                <span className="text-[11px] text-muted-foreground mt-1">Celkem aktivních v ZD</span>
              </button>
              <button
                type="button"
                onClick={() => setWindowFilter("ending_14")}
                className={cn(
                  "flex flex-col items-start rounded-md border p-3 text-left transition-colors",
                  stats.urgent7 > 0
                    ? "border-destructive/40 bg-destructive/5 hover:bg-destructive/10"
                    : "border-border bg-card hover:bg-muted/40"
                )}
              >
                <span className={cn("text-2xl font-bold", stats.urgent7 > 0 && "text-destructive")}>
                  {stats.urgent7}
                </span>
                <span className="text-[11px] text-muted-foreground mt-1">Končí do 7 dní (urgentní)</span>
              </button>
              <button
                type="button"
                onClick={() => setWindowFilter("ending_14")}
                className={cn(
                  "flex flex-col items-start rounded-md border p-3 text-left transition-colors",
                  stats.upcoming14 > 0
                    ? "border-status-warning/40 bg-status-warning/5 hover:bg-status-warning/10"
                    : "border-border bg-card hover:bg-muted/40"
                )}
              >
                <span className={cn("text-2xl font-bold", stats.upcoming14 > 0 && "text-status-warning")}>
                  {stats.upcoming14}
                </span>
                <span className="text-[11px] text-muted-foreground mt-1">Končí za 8–14 dní</span>
              </button>
              <button
                type="button"
                onClick={() => setWindowFilter("ending_30")}
                className="flex flex-col items-start rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors p-3 text-left"
              >
                <span className="text-2xl font-bold text-primary">{stats.upcoming30}</span>
                <span className="text-[11px] text-muted-foreground mt-1">Končí za 15–30 dní</span>
              </button>
            </div>
          )}

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
                    setWindowFilter("all_active");
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Vyčistit
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={handleCsvExport} title={CSV_FORMAT_TOOLTIP}>
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
                <Button variant="outline" size="sm" onClick={handlePdfExport} title="Formát: PDF (přehled zkušebních dob)">
                  <FileText className="h-4 w-4 mr-1" /> Export PDF
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
                  <TableHead className="text-right w-[1%]">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="p-0">
                      <EmptyState
                        icon={ClipboardList}
                        title="Žádní zaměstnanci v tomto okně"
                        description="Zkuste změnit filtr nebo vyhledávací kritéria."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((e) => {
                    const days = daysUntil(e.probationEndDate!);
                    const isUrgent = days <= 7;
                    const isWarning = days > 7 && days <= 14;
                    return (
                    <TableRow
                      key={e.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/40 border-l-4",
                        isUrgent ? "border-l-destructive bg-destructive/5" :
                        isWarning ? "border-l-status-warning bg-status-warning/5" :
                        "border-l-transparent"
                      )}
                      onClick={() => goToEmployeeProbation(e.id)}
                    >
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
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            goToEmployeeProbation(e.id);
                          }}
                          title="Upravit zkušební dobu"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs">Upravit ZD</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
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
