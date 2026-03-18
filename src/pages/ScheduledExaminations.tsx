import { StatusBadge } from "@/components/StatusBadge";
import { StatusLegend } from "@/components/StatusLegend";
import { WorkCategoryBadge } from "@/components/WorkCategoryBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Plus, Download, RefreshCw, Eye } from "lucide-react";
import { ResultBadge } from "@/components/ResultBadge";
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

export default function ScheduledExaminations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const { examinations, loading: examinationsLoading, error: examinationsError, refetch } = useMedicalExaminations(true);
  const { facilities: facilitiesData } = useFacilities();
  const [selectedExaminations, setSelectedExaminations] = useState<Set<string>>(new Set());
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
      "Platnost do": format(new Date(e.nextExaminationDate), "dd.MM.yyyy"),
      "Typ prohlídky": e.type,
      "Os. číslo": e.employeeNumber,
      "Jméno": e.employeeName,
      "Datum narození": e.employeeBirthDate ? format(parseISO(e.employeeBirthDate), "dd.MM.yyyy") : "",
      "Věk": e.employeeBirthDate ? String(differenceInYears(new Date(), parseISO(e.employeeBirthDate))) : "",
      "Kategorie": e.employeeWorkCategory ? `Kategorie ${e.employeeWorkCategory}` : "-",
      "Provozovna": getFacilityName(e.facility) || "",
      "Středisko": formatDepartment(e.department, e.departmentName),
      "Datum prohlídky": format(new Date(e.lastExaminationDate), "dd.MM.yyyy"),
      "Periodicita": formatPeriodicity(e.period),
      "Výsledek": getMedicalExaminationResultLabel(e.result),
      "Datum pozbytí dlouhodobé způsobilosti": e.longTermFitnessLossDate ? format(new Date(e.longTermFitnessLossDate), "dd.MM.yyyy") : "",
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
        <TableSkeleton columns={12} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">Naplánované prohlídky</h2>
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
              <TableHead>Dat. nar.</TableHead>
              <TableHead>Věk</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Zdravotní rizika</TableHead>
              <TableHead>Výsledek</TableHead>
              <TableHead>Poznámka</TableHead>
              <TableHead>Datum pozbytí ZD způsobilosti</TableHead>
              <TableHead>Protokol</TableHead>
              <SortableTableHead label="Lékař" sortKey="doctor" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedExaminations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 16 : 15} className="text-center text-muted-foreground py-8">
                  Žádné prohlídky k zobrazení.
                </TableCell>
              </TableRow>
            ) : (
              sortedExaminations.map((exam) => (
                <TableRow key={exam.id}>
                  {canEdit && (
                    <TableCell>
                      <Checkbox checked={selectedExaminations.has(exam.id)} onCheckedChange={() => toggleSelectExamination(exam.id)} />
                    </TableCell>
                  )}
                  <TableCell>
                    <StatusBadge status={exam.status} />
                  </TableCell>
                  <TableCell>{format(new Date(exam.nextExaminationDate), "dd.MM.yyyy")}</TableCell>
                  <TableCell className="font-medium">{exam.type}</TableCell>
                  <TableCell>{exam.employeeNumber}</TableCell>
                  <TableCell>{exam.employeeName}</TableCell>
                  <TableCell className="text-sm">
                    {exam.employeeBirthDate ? format(parseISO(exam.employeeBirthDate), "dd.MM.yyyy") : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-center">
                    {exam.employeeBirthDate ? differenceInYears(new Date(), parseISO(exam.employeeBirthDate)) : "-"}
                  </TableCell>
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
                   <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={exam.note || ""}>
                     {exam.note || "-"}
                   </TableCell>
                   <TableCell className="text-sm whitespace-nowrap">
                     {exam.longTermFitnessLossDate ? format(new Date(exam.longTermFitnessLossDate), "dd.MM.yyyy") : "-"}
                   </TableCell>
                   <TableCell className="text-center">
                     <MedicalProtocolCell examinationId={exam.id} />
                   </TableCell>
                   <TableCell>{exam.doctor || "-"}</TableCell>
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
              ))
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
