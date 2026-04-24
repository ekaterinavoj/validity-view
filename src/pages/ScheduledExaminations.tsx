import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TypePeriodicityCell, formatPeriodicityDual } from "@/components/TypePeriodicityCell";
import { StatusLegend } from "@/components/StatusLegend";
import { WorkCategoryBadge } from "@/components/WorkCategoryBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Plus, Download, Eye, Upload } from "lucide-react";
import { ResultBadge } from "@/components/ResultBadge";
import { NoteTooltipText } from "@/components/NoteTooltipText";
import { ExpandableToggle, ExpandableDetailRow } from "@/components/ExpandableRowDetail";
import { useFacilities } from "@/hooks/useFacilities";
import { useMemo, useState } from "react";
import { useSortable } from "@/hooks/useSortable";
import { SortableTableHead } from "@/components/SortableTableHead";
import { useToast } from "@/hooks/use-toast";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { MedicalProtocolCell } from "@/components/MedicalProtocolCell";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { formatDisplayDate, calculateAge } from "@/lib/dateFormat";
import Papa from "papaparse";
// formatPeriodicity replaced by formatPeriodicityDual from TypePeriodicityCell

import { formatDepartment } from "@/components/DepartmentCell";
import { useMedicalExaminations } from "@/hooks/useMedicalExaminations";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { useAuth } from "@/contexts/AuthContext";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkEditExaminationsDialog } from "@/components/BulkEditExaminationsDialog";
import { BulkArchiveDialog } from "@/components/BulkArchiveDialog";
import { HealthRisksSummary } from "@/components/HealthRisksSummary";
import { getMedicalExaminationResultLabel } from "@/lib/medicalExaminationResults";
import { EmployeeStatusBadge, getEmployeeStatusLabel } from "@/components/EmployeeStatusBadge";
import { HEALTH_RISK_FIELDS } from "@/lib/healthRisks";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { BulkMedicalImport } from "@/components/BulkMedicalImport";
import { PeriodOverrideIcon } from "@/components/PeriodOverrideIndicator";
import { downloadPLPDetailXLSX, type PLPDetailRow } from "@/lib/matrixExport";
import { useEmployees } from "@/hooks/useEmployees";
import { useMedicalExaminationTypes } from "@/hooks/useMedicalExaminationTypes";
import { Grid3x3 } from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

export default function ScheduledExaminations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const [showInactiveEmployees, setShowInactiveEmployees] = useState(false);
  const { examinations, loading: examinationsLoading, error: examinationsError, refetch } = useMedicalExaminations(!showInactiveEmployees);
  const { facilities: facilitiesData } = useFacilities();
  const { employees: allEmployees } = useEmployees();
  const { examinationTypes: allExamTypes } = useMedicalExaminationTypes();
  const [selectedExaminations, setSelectedExaminations] = useState<Set<string>>(new Set());
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [exportingMatrix, setExportingMatrix] = useState(false);

  const facilityNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    facilitiesData.forEach((f) => {
      map[f.code] = f.name;
    });
    return map;
  }, [facilitiesData]);

  const getFacilityName = (code: string): string => {
    return facilityNameMap[code] || code;
  };

  const { filters, updateFilter, clearFilters, hasActiveFilters, saveCurrentFilters, loadSavedFilter, deleteSavedFilter, savedFilters } = useAdvancedFilters("scheduled-examinations-filters");

  const departments = useMemo(() => {
    const deptMap = new Map<string, string>();
    examinations.forEach((e) => {
      if (e.department) {
        const formatted = e.departmentName && e.departmentName !== e.department
          ? `${e.department} - ${e.departmentName}`
          : e.department;
        deptMap.set(formatted, formatted);
      }
    });
    return Array.from(deptMap.keys()).sort();
  }, [examinations]);

  const facilities = useMemo(() => {
    const facilitySet = new Set(examinations.map((e) => getFacilityName(e.facility)).filter(Boolean));
    return Array.from(facilitySet).sort();
  }, [examinations, facilityNameMap]);

  const examinationTypes = useMemo(() => {
    const types = new Set(examinations.map((e) => e.type).filter(Boolean));
    return Array.from(types).sort();
  }, [examinations]);

  const doctors = useMemo(() => {
    const docSet = new Set(examinations.map((e) => e.doctor).filter(Boolean));
    return Array.from(docSet).sort();
  }, [examinations]);

  // Result options jsou převzaty z lib/medicalExaminationResults — všechny role
  // používají stejné názvy a vidí stejné filtry (RLS pak omezí obsah).
  const resultOptions = useMemo(
    () => [
      { value: "passed", label: "Zdravotně způsobilý/á" },
      { value: "passed_with_reservations", label: "Způsobilý/á s podmínkou" },
      { value: "failed", label: "Není způsobilý/á" },
      { value: "lost_long_term", label: "Pozbyl(a) dlouhodobě způsobilosti" },
    ],
    [],
  );

  const workCategoryOptions = useMemo(() => {
    const cats = new Set<string>();
    examinations.forEach((e) => {
      if (e.employeeWorkCategory) cats.add(e.employeeWorkCategory);
    });
    return Array.from(cats)
      .sort()
      .map((c) => ({ value: c, label: `Kategorie ${c}` }));
  }, [examinations]);

  const filteredExaminations = useMemo(() => {
    return examinations.filter((exam) => {
      const searchLower = filters.searchQuery.toLowerCase();
      const matchesSearch =
        filters.searchQuery === "" ||
        exam.employeeName.toLowerCase().includes(searchLower) ||
        exam.employeeNumber.includes(searchLower) ||
        exam.type.toLowerCase().includes(searchLower) ||
        exam.department.toLowerCase().includes(searchLower) ||
        exam.doctor.toLowerCase().includes(searchLower);

      const matchesStatus = filters.statusFilter === "all" || exam.status === filters.statusFilter;
      const matchesFacility = filters.facilityFilter === "all" || getFacilityName(exam.facility) === filters.facilityFilter;
      const deptFormatted = exam.departmentName && exam.departmentName !== exam.department
        ? `${exam.department} - ${exam.departmentName}`
        : exam.department;
      const matchesDepartment = filters.departmentFilter === "all" || deptFormatted === filters.departmentFilter;
      const matchesType = filters.typeFilter === "all" || exam.type === filters.typeFilter;
      const matchesDoctor = filters.trainerFilter === "all" || exam.doctor === filters.trainerFilter;
      const matchesResult = filters.resultFilter === "all" || (exam.result ?? "") === filters.resultFilter;
      const matchesWorkCategory =
        filters.workCategoryFilter === "all" || (exam.employeeWorkCategory ?? "") === filters.workCategoryFilter;

      const examDate = new Date(exam.nextExaminationDate);
      const matchesDateFrom = !filters.dateFrom || examDate >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || examDate <= filters.dateTo;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFacility &&
        matchesDepartment &&
        matchesType &&
        matchesDoctor &&
        matchesResult &&
        matchesWorkCategory &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [filters, examinations, facilityNameMap]);

  const { sortedData: sortedExaminations, sortConfig, requestSort } = useSortable(filteredExaminations);
  const { preferences } = useUserPreferences();
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems } = usePagination(sortedExaminations, preferences.itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedExaminations.size === filteredExaminations.length) {
      setSelectedExaminations(new Set());
    } else {
      setSelectedExaminations(new Set(filteredExaminations.map((e) => e.id)));
    }
  };

  const toggleSelectExamination = (id: string) => {
    const newSelected = new Set(selectedExaminations);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedExaminations(newSelected);
  };

  const handleBulkEdit = () => {
    setBulkEditDialogOpen(true);
  };

  const handleBulkArchive = () => {
    setDeleteDialogOpen(true);
  };

  const confirmBulkArchive = async () => {
    if (selectedExaminations.size === 0) return;

    setLoading(true);
    try {
      const selectedIds = Array.from(selectedExaminations);
      const { error } = await supabase.from("medical_examinations").update({ deleted_at: new Date().toISOString(), is_active: false }).in("id", selectedIds);
      if (error) throw error;

      toast({ title: "Prohlídky archivovány", description: `Úspěšně archivováno ${selectedExaminations.size} prohlídek.` });
      setSelectedExaminations(new Set());
      setDeleteDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({ title: "Chyba při archivaci", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const dataToExport = selectedExaminations.size > 0 ? examinations.filter((e) => selectedExaminations.has(e.id)) : examinations;

    const data = dataToExport.map((e) => ({
      "Stav": e.status === "valid" ? "Platné" : e.status === "warning" ? "Blíží se" : "Expirované",
      "Platnost do": formatDisplayDate(e.nextExaminationDate, ""),
      "Typ prohlídky": e.type,
      "Os. číslo": e.employeeNumber,
      "Jméno": e.employeeName,
      "Stav zaměstnance": getEmployeeStatusLabel(e.employeeStatus),
      "Datum narození": e.employeeBirthDate ? formatDisplayDate(e.employeeBirthDate, "") : "",
      "Věk": e.employeeBirthDate ? String(calculateAge(e.employeeBirthDate) ?? "") : "",
      "Kategorie": e.employeeWorkCategory ? `Kategorie ${e.employeeWorkCategory}` : "-",
      "Provozovna": getFacilityName(e.facility) || "",
      "Středisko": formatDepartment(e.department, e.departmentName),
      "Datum prohlídky": formatDisplayDate(e.lastExaminationDate, ""),
      "Periodicita": formatPeriodicityDual(e.period),
      "Výsledek": getMedicalExaminationResultLabel(e.result),
      "Datum pozbytí dlouhodobé způsobilosti": e.longTermFitnessLossDate ? formatDisplayDate(e.longTermFitnessLossDate, "") : "",
      "Lékař": e.doctor || "",
      "Zdravotnické zařízení": e.medicalFacility || "",
      "Zadavatel": e.requester || "",
      "Poznámka": e.note || "",
      ...Object.fromEntries(
        HEALTH_RISK_FIELDS.map(field => [
          `Zdravotní riziko – ${field.label}`,
          e.healthRisks[field.key] || "",
        ])
      ),
    }));

    const csv = Papa.unparse(data, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `prohlidky_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const exportMatrix = async () => {
    setExportingMatrix(true);
    try {
      // Build one row per examination (visible by RLS).
      // For each examination: name, last/next date, type, work category, active health risks, result, note.
      const activeRisks = (risks: any): string => {
        if (!risks || typeof risks !== "object") return "";
        const labels: Record<string, string> = HEALTH_RISK_FIELDS.reduce(
          (acc, f) => {
            acc[f.key] = f.label;
            return acc;
          },
          {} as Record<string, string>,
        );
        return Object.entries(risks)
          .filter(([, v]) => v && v !== "ne" && v !== "no" && v !== "false" && v !== false)
          .map(([k]) => labels[k] ?? k)
          .join(", ");
      };

      const rows: PLPDetailRow[] = examinations.map((ex) => ({
        fullName: ex.employeeName ?? "",
        examinationDate: ex.lastExaminationDate ? formatDisplayDate(ex.lastExaminationDate) : "",
        expiryDate: ex.nextExaminationDate ? formatDisplayDate(ex.nextExaminationDate) : "",
        examinationType: ex.type ?? "",
        workCategory: ex.employeeWorkCategory ?? "",
        healthRisks: activeRisks(ex.healthRisks),
        result: ex.result ? getMedicalExaminationResultLabel(ex.result) : "",
        note: ex.note ?? "",
      }));

      downloadPLPDetailXLSX({
        filename: `prehled_plp_${format(new Date(), "yyyy-MM-dd")}`,
        rows,
      });
      toast({ title: "Přehled exportován", description: `${rows.length} prohlídek` });
    } catch (err: any) {
      toast({ title: "Chyba", description: err?.message ?? "Nepodařilo se vygenerovat přehled.", variant: "destructive" });
    } finally {
      setExportingMatrix(false);
    }
  };

  // Total columns: expand + (checkbox?) + status + platnost + typ + os.č. + jméno + středisko + datum + kategorie + zdr.rizika + výsledek + poznámka + protokol + akce = 14 or 15
  const totalColumns = canEdit ? 15 : 14;

  if (examinationsError) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-foreground">Naplánované prohlídky</h2>
        <ErrorDisplay title="Nepodařilo se načíst data" message={examinationsError} onRetry={refetch} />
      </div>
    );
  }

  if (examinationsLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <TableSkeleton columns={13} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-foreground">Naplánované prohlídky</h2>
          <div className="flex items-center gap-3">
            <Switch id="show-inactive-plp" checked={showInactiveEmployees} onCheckedChange={setShowInactiveEmployees} />
            <Label htmlFor="show-inactive-plp" className="text-sm text-muted-foreground">
              Zobrazit zaměstnance na mateřské a nemocenské i mimo historii
            </Label>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} title="Formát: CSV (středník, UTF-8)">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportMatrix}
            disabled={exportingMatrix || examinations.length === 0}
            title="Formát: CSV — jméno, datum, konec, typ, kategorie, rizika, výsledek, poznámka"
          >
            <Grid3x3 className="w-4 h-4 mr-2" />
            {exportingMatrix ? "Generuji…" : "Přehled"}
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setShowImport(!showImport)}>
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          )}
          <RefreshButton onRefresh={() => refetch()} loading={examinationsLoading} />
          {canEdit && (
            <Button onClick={() => navigate("/plp/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Nová prohlídka
            </Button>
          )}
        </div>
      </div>

      {showImport && canEdit && (
        <BulkMedicalImport />
      )}

      <div className="flex items-center justify-between">
        <StatusLegend variant="training" />
        <p className="text-sm text-muted-foreground">
          Celkem: {filteredExaminations.length} prohlídek
        </p>
      </div>

      <AdvancedFilters
        filters={filters}
        onFilterChange={updateFilter}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        savedFilters={savedFilters}
        onSaveFilters={saveCurrentFilters}
        onLoadFilter={loadSavedFilter}
        onDeleteFilter={deleteSavedFilter}
        facilities={facilities}
        departments={departments}
        trainingTypes={examinationTypes}
        trainers={doctors}
        trainerLabel="doctors"
        resultOptions={resultOptions}
        workCategoryOptions={workCategoryOptions}
      />

      {canEdit && (
        <BulkActionsBar
          selectedCount={selectedExaminations.size}
          onClearSelection={() => setSelectedExaminations(new Set())}
          onBulkEdit={handleBulkEdit}
          onBulkArchive={handleBulkArchive}
          entityName="prohlídek"
        />
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              {canEdit && (
                <TableHead className="w-[40px]">
                  <Checkbox checked={selectedExaminations.size === filteredExaminations.length && filteredExaminations.length > 0} onCheckedChange={toggleSelectAll} />
                </TableHead>
              )}
              <SortableTableHead label="Stav" sortKey="status" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
              <SortableTableHead label="Platnost do" sortKey="nextExaminationDate" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
              <SortableTableHead label="Typ prohlídky" sortKey="type" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
              <SortableTableHead label="Os. číslo" sortKey="employeeNumber" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
              <SortableTableHead label="Jméno" sortKey="employeeName" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
              
              <TableHead>Středisko</TableHead>
              <TableHead>Datum prohlídky</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Zdravotní rizika</TableHead>
              <TableHead>Výsledek</TableHead>
              <TableHead>Poznámka</TableHead>
              <TableHead>Protokol</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedExaminations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalColumns} className="text-center text-muted-foreground py-8">
                  Žádné prohlídky k zobrazení.
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((exam) => {
                const isExpanded = expandedRowId === exam.id;
                return (
                  <>
                    <TableRow key={exam.id}>
                      <TableCell className="w-[40px] px-2">
                        <ExpandableToggle
                          isExpanded={isExpanded}
                          onToggle={() => setExpandedRowId(isExpanded ? null : exam.id)}
                        />
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Checkbox checked={selectedExaminations.has(exam.id)} onCheckedChange={() => toggleSelectExamination(exam.id)} />
                        </TableCell>
                      )}
                      <TableCell>
                        <StatusBadge status={exam.status} />
                      </TableCell>
                      <TableCell>{formatDisplayDate(exam.nextExaminationDate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TypePeriodicityCell typeName={exam.type} periodDays={exam.typePeriodDays} description={exam.typeDescription} />
                          <PeriodOverrideIcon overrideDays={exam.period !== exam.typePeriodDays ? exam.period : null} typeDays={exam.typePeriodDays} />
                        </div>
                      </TableCell>
                      <TableCell>{exam.employeeNumber}</TableCell>
                      <TableCell>{exam.employeeName}</TableCell>
                      
                      <TableCell>{formatDepartment(exam.department, exam.departmentName)}</TableCell>
                      <TableCell>{formatDisplayDate(exam.lastExaminationDate)}</TableCell>
                      <TableCell><WorkCategoryBadge category={exam.employeeWorkCategory} /></TableCell>
                      <TableCell className="min-w-[260px] align-top">
                        <HealthRisksSummary value={exam.healthRisks} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ResultBadge
                            result={(exam.result as any) || "passed"}
                            context="medical"
                            note={exam.note || undefined}
                          />
                          {exam.longTermFitnessLossDate && exam.result !== "lost_long_term" && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="w-4 h-4 text-status-warning cursor-help shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-sm">
                                    Současně pozbyl(a) dlouhodobě zdravotní způsobilosti
                                    {exam.longTermFitnessLossDate ? ` (${formatDisplayDate(exam.longTermFitnessLossDate)})` : ""}.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <NoteTooltipText note={exam.note} />
                      </TableCell>
                      <TableCell className="text-center">
                        <MedicalProtocolCell examinationId={exam.id} />
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/plp/edit/${exam.id}`)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/plp/edit/${exam.id}`)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <ExpandableDetailRow
                        colSpan={totalColumns}
                        fields={[
                          { label: "Provozovna", value: getFacilityName(exam.facility) },
                          { label: "Stav zaměstnance", value: getEmployeeStatusLabel(exam.employeeStatus) },
                          { label: "Datum narození", value: exam.employeeBirthDate ? formatDisplayDate(exam.employeeBirthDate) : null },
                          { label: "Věk", value: exam.employeeBirthDate ? calculateAge(exam.employeeBirthDate) : null },
                          {
                            label: "Periodicita",
                            value: exam.period !== exam.typePeriodDays
                              ? `${formatPeriodicityDual(exam.period)} (vlastní – typ má ${formatPeriodicityDual(exam.typePeriodDays)})`
                              : formatPeriodicityDual(exam.period),
                          },
                          ...(exam.typeDescription ? [{ label: "Popis typu", value: exam.typeDescription }] : []),
                          { label: "Datum pozbytí dlouhodobé způsobilosti", value: exam.longTermFitnessLossDate ? formatDisplayDate(exam.longTermFitnessLossDate) : null },
                          { label: "Lékař", value: exam.doctor },
                          { label: "Zdravotnické zařízení", value: exam.medicalFacility },
                          { label: "Zadavatel", value: exam.requester },
                        ]}
                      />
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={preferences.itemsPerPage} onPageChange={setCurrentPage} />
      </Card>

      <BulkEditExaminationsDialog
        open={bulkEditDialogOpen}
        onOpenChange={setBulkEditDialogOpen}
        selectedIds={Array.from(selectedExaminations)}
        onSuccess={() => {
          setSelectedExaminations(new Set());
          refetch();
        }}
      />

      <BulkArchiveDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        selectedCount={selectedExaminations.size}
        onConfirm={confirmBulkArchive}
        loading={loading}
        entityName="prohlídek"
      />
    </div>
  );
}
