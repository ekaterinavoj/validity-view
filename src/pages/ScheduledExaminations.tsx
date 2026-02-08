import { StatusBadge } from "@/components/StatusBadge";
import { StatusLegend } from "@/components/StatusLegend";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Plus, FileDown, Loader2, Archive, RefreshCw, Eye, FileText } from "lucide-react";
import { useFacilities } from "@/hooks/useFacilities";
import { useMemo, useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";

interface ExaminationDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
}

export default function ScheduledExaminations() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { examinations, loading: examinationsLoading, error: examinationsError, refetch } = useMedicalExaminations(true);
  const { facilities: facilitiesData } = useFacilities();
  const [selectedExaminations, setSelectedExaminations] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Record<string, ExaminationDocument[]>>({});
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; fileType: string } | null>(null);

  // Load documents for all examinations
  useEffect(() => {
    const loadDocuments = async () => {
      if (examinations.length === 0) return;
      
      const examIds = examinations.map(e => e.id);
      const { data, error } = await supabase
        .from("medical_examination_documents")
        .select("id, examination_id, file_name, file_path, file_type")
        .in("examination_id", examIds);

      if (!error && data) {
        const docsMap: Record<string, ExaminationDocument[]> = {};
        data.forEach((doc: any) => {
          if (!docsMap[doc.examination_id]) {
            docsMap[doc.examination_id] = [];
          }
          docsMap[doc.examination_id].push({
            id: doc.id,
            file_name: doc.file_name,
            file_path: doc.file_path,
            file_type: doc.file_type,
          });
        });
        setDocuments(docsMap);
      }
    };

    loadDocuments();
  }, [examinations]);

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
      Kategorie: e.employeeWorkCategory ? `Kategorie ${e.employeeWorkCategory}` : "-",
      "Typ prohlídky": e.type,
      "Datum prohlídky": format(new Date(e.lastExaminationDate), "dd.MM.yyyy"),
      "Platnost do": format(new Date(e.nextExaminationDate), "dd.MM.yyyy"),
      Periodicita: formatPeriodicity(e.period),
      Výsledek: e.result || "-",
      Lékař: e.doctor,
      "Zdravotnické zařízení": e.medicalFacility,
      Stav: e.status === "valid" ? "Platné" : e.status === "warning" ? "Blíží se" : "Expirované",
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prohlídky");
    XLSX.writeFile(wb, `prohlidky_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const getCategoryBadge = (category: number | null) => {
    if (!category) return <span className="text-muted-foreground">-</span>;
    const colors: Record<number, string> = {
      1: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      2: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      3: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      4: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return <Badge className={colors[category]}>{category}</Badge>;
  };

  const handlePreviewDocument = async (doc: ExaminationDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("medical-documents")
        .createSignedUrl(doc.file_path, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        setPreviewDoc({
          url: data.signedUrl,
          fileName: doc.file_name,
          fileType: doc.file_type,
        });
      }
    } catch (err: any) {
      toast({
        title: "Chyba při načítání dokumentu",
        description: err.message,
        variant: "destructive",
      });
    }
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
              <TableHead>Kategorie</TableHead>
              <TableHead>Výsledek</TableHead>
              <TableHead>Protokol</TableHead>
              <TableHead>Lékař</TableHead>
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
                  <TableCell>{getCategoryBadge(exam.employeeWorkCategory)}</TableCell>
                  <TableCell>
                    {exam.result ? (
                      <span className="text-sm">{exam.result}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {documents[exam.id] && documents[exam.id].length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreviewDocument(documents[exam.id][0])}
                        className="flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        <FileText className="w-4 h-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>{exam.doctor || "-"}</TableCell>
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

      <FilePreviewDialog
        open={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        file={previewDoc ? { name: previewDoc.fileName, url: previewDoc.url, type: previewDoc.fileType } : null}
      />

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
