import { StatusBadge } from "@/components/StatusBadge";
import { StatusLegend } from "@/components/StatusLegend";
import { WorkCategoryBadge } from "@/components/WorkCategoryBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Plus, Download, RefreshCw, Eye } from "lucide-react";
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
import { format, differenceInYears, parseISO } from "date-fns";
import Papa from "papaparse";
import { formatPeriodicity } from "@/lib/utils";
import { formatDisplayDate } from "@/lib/dateFormat";
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
import { EmployeeStatusBadge } from "@/components/EmployeeStatusBadge";

export default function ScheduledExaminations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const [showInactiveEmployees, setShowInactiveEmployees] = useState(false);
  const { examinations, loading: examinationsLoading, error: examinationsError, refetch } = useMedicalExaminations(!showInactiveEmployees);
  const { facilities: facilitiesData } = useFacilities();
  const [selectedExaminations, setSelectedExaminations] = useState<Set<string>>(new Set());
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

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
    const depts = new Set(examinations.map((e) => e.department).filter(Boolean));
    return Array.from(depts).sort();
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
      const matchesDepartment = filters.departmentFilter === "all" || exam.department === filters.departmentFilter;
      const matchesType = filters.typeFilter === "all" || exam.type === filters.typeFilter;
      const matchesDoctor = filters.trainerFilter === "all" || exam.doctor === filters.trainerFilter;

      const examDate = new Date(exam.nextExaminationDate);
      const matchesDateFrom = !filters.dateFrom || examDate >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || examDate <= filters.dateTo;

      return matchesSearch && matchesStatus && matchesFacility && matchesDepartment && matchesType && matchesDoctor && matchesDateFrom && matchesDateTo;
    });
  }, [filters, examinations, facilityNameMap]);

  const { sortedData: sortedExaminations, sortConfig, requestSort } = useSortable(filteredExaminations);

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
    const dataToExport = selectedExaminations.size > 0 ? filteredExaminations.filter((e) => selectedExaminations.has(e.id)) : filteredExaminations;

    const data = dataToExport.map((e) => ({
      "Stav": e.status === "valid" ? "Platné" : e.status === "warning" ? "Blíží se" : "Expirované",
      "Platnost do": formatDisplayDate(e.nextExaminationDate, ""),
      "Typ prohlídky": e.type,
      "Os. číslo": e.employeeNumber,
      "Jméno": e.employeeName,
      "Stav zaměstnance": e.employeeStatus,
      "Datum narození": e.employeeBirthDate ? formatDisplayDate(e.employeeBirthDate, "") : "",
      "Věk": e.employeeBirthDate ? String(differenceInYears(new Date(), parseISO(e.employeeBirthDate))) : "",
      "Kategorie": e.employeeWorkCategory ? `Kategorie ${e.employeeWorkCategory}` : "-",
      "Provozovna": getFacilityName(e.facility) || "",
      "Středisko": formatDepartment(e.department, e.departmentName),
      "Datum prohlídky": formatDisplayDate(e.lastExaminationDate, ""),
      "Periodicita": formatPeriodicity(e.period),
      "Výsledek": getMedicalExaminationResultLabel(e.result),
      "Datum pozbytí dlouhodobé způsobilosti": e.longTermFitnessLossDate ? formatDisplayDate(e.longTermFitnessLossDate, "") : "",
      "Lékař": e.doctor || "",
      "Zdravotnické zařízení": e.medicalFacility || "",
      "Zadavatel": e.requester || "",
      "Poznámka": e.note || "",
    }));

    const csv = Papa.unparse(data, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `prohlidky_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  // Total columns: expand + (checkbox?) + status + platnost + typ + os.č. + jméno + provozovna + středisko + datum + kategorie + zdr.rizika + výsledek + poznámka + protokol + akce = 15 or 16
  const totalColumns = canEdit ? 16 : 15;

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
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {canEdit && (
            <Button onClick={() => navigate("/plp/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Nová prohlídka
            </Button>
          )}
        </div>
      </div>

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
              <TableHead>Provozovna</TableHead>
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
              sortedExaminations.map((exam) => {
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
                      <TableCell className="font-medium">{exam.type}</TableCell>
                      <TableCell>{exam.employeeNumber}</TableCell>
                      <TableCell>{exam.employeeName}</TableCell>
                      <TableCell>{getFacilityName(exam.facility)}</TableCell>
                      <TableCell>{formatDepartment(exam.department, exam.departmentName)}</TableCell>
                      <TableCell>{formatDisplayDate(exam.lastExaminationDate)}</TableCell>
                      <TableCell><WorkCategoryBadge category={exam.employeeWorkCategory} /></TableCell>
                      <TableCell className="min-w-[260px] align-top">
                        <HealthRisksSummary value={exam.healthRisks} />
                      </TableCell>
                      <TableCell>
                        <ResultBadge
                          result={(exam.result as any) || "passed"}
                          context="medical"
                          note={exam.note || undefined}
                        />
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
                          { label: "Stav zaměstnance", value: exam.employeeStatus },
                          { label: "Datum narození", value: exam.employeeBirthDate ? formatDisplayDate(exam.employeeBirthDate) : null },
                          { label: "Věk", value: exam.employeeBirthDate ? differenceInYears(new Date(), parseISO(exam.employeeBirthDate)) : null },
                          { label: "Periodicita", value: formatPeriodicity(exam.period) },
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
