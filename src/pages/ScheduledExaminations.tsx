import { StatusBadge } from "@/components/StatusBadge";
import { StatusLegend } from "@/components/StatusLegend";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Plus, FileDown, Loader2, Archive, RefreshCw } from "lucide-react";
import { useFacilities } from "@/hooks/useFacilities";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import * as XLSX from "xlsx";
import { formatPeriodicity } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMedicalExaminations, MedicalExaminationWithDetails } from "@/hooks/useMedicalExaminations";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";

export default function ScheduledExaminations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { examinations, loading: examinationsLoading, error: examinationsError, refetch } = useMedicalExaminations(true);
  const { facilities: facilitiesData } = useFacilities();
  const [selectedExaminations, setSelectedExaminations] = useState<Set<string>>(new Set());
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

  const handleBulkArchive = () => {
    if (selectedExaminations.size === 0) {
      toast({ title: "Žádné prohlídky vybrány", description: "Vyberte alespoň jednu prohlídku pro archivaci.", variant: "destructive" });
      return;
    }
    setDeleteDialogOpen(true);
  };

  const confirmBulkArchive = async () => {
    if (selectedExaminations.size === 0) return;

    setLoading(true);
    try {
      const selectedIds = Array.from(selectedExaminations);
      const { error } = await supabase.from("medical_examinations").update({ deleted_at: new Date().toISOString() }).in("id", selectedIds);
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

  const exportToExcel = () => {
    const dataToExport = selectedExaminations.size > 0 ? filteredExaminations.filter((e) => selectedExaminations.has(e.id)) : filteredExaminations;

    const wsData = dataToExport.map((e) => ({
      "Os. číslo": e.employeeNumber,
      Jméno: e.employeeName,
      Středisko: e.department,
      Provozovna: getFacilityName(e.facility),
      "Typ prohlídky": e.type,
      "Datum prohlídky": format(new Date(e.lastExaminationDate), "dd.MM.yyyy"),
      "Platnost do": format(new Date(e.nextExaminationDate), "dd.MM.yyyy"),
      Periodicita: formatPeriodicity(e.period),
      Lékař: e.doctor,
      "Zdravotnické zařízení": e.medicalFacility,
      Stav: e.status === "valid" ? "Platné" : e.status === "warning" ? "Blíží se" : "Expirované",
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prohlídky");
    XLSX.writeFile(wb, `prohlidky_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
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
        <TableSkeleton columns={11} />
        
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
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <FileDown className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => navigate("/plp/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Nová prohlídka
          </Button>
        </div>
      </div>

      <StatusLegend variant="training" />

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
      />

      {selectedExaminations.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">Vybráno: {selectedExaminations.size}</span>
          <Button variant="destructive" size="sm" onClick={handleBulkArchive}>
            <Archive className="w-4 h-4 mr-2" />
            Archivovat
          </Button>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox checked={selectedExaminations.size === filteredExaminations.length && filteredExaminations.length > 0} onCheckedChange={toggleSelectAll} />
              </TableHead>
              <TableHead>Stav</TableHead>
              <TableHead>Platnost do</TableHead>
              <TableHead>Typ prohlídky</TableHead>
              <TableHead>Os. číslo</TableHead>
              <TableHead>Jméno</TableHead>
              <TableHead>Středisko</TableHead>
              <TableHead>Provozovna</TableHead>
              <TableHead>Lékař</TableHead>
              <TableHead>Periodicita</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExaminations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  Žádné prohlídky k zobrazení.
                </TableCell>
              </TableRow>
            ) : (
              filteredExaminations.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell>
                    <Checkbox checked={selectedExaminations.has(exam.id)} onCheckedChange={() => toggleSelectExamination(exam.id)} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={exam.status} />
                  </TableCell>
                  <TableCell>{format(new Date(exam.nextExaminationDate), "dd.MM.yyyy")}</TableCell>
                  <TableCell className="font-medium">{exam.type}</TableCell>
                  <TableCell>{exam.employeeNumber}</TableCell>
                  <TableCell>{exam.employeeName}</TableCell>
                  <TableCell>{exam.department}</TableCell>
                  <TableCell>{getFacilityName(exam.facility)}</TableCell>
                  <TableCell>{exam.doctor || "-"}</TableCell>
                  <TableCell>{formatPeriodicity(exam.period)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/plp/edit/${exam.id}`)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivovat vybrané prohlídky?</AlertDialogTitle>
            <AlertDialogDescription>Bude archivováno {selectedExaminations.size} prohlídek. Archivované záznamy budou dostupné v historii.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkArchive} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Archivovat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
