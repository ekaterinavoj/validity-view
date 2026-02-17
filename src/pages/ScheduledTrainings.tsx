import { StatusBadge } from "@/components/StatusBadge";
import { StatusLegend } from "@/components/StatusLegend";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Plus, CalendarClock, FileDown, Eye, Download } from "lucide-react";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { useFacilities } from "@/hooks/useFacilities";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { TrainingProtocolCell } from "@/components/TrainingProtocolCell";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPeriodicity } from "@/lib/utils";
import { useTrainings } from "@/hooks/useTrainings";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkArchiveDialog } from "@/components/BulkArchiveDialog";
import { BulkEditTrainingsDialog } from "@/components/BulkEditTrainingsDialog";

export default function ScheduledTrainings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const { trainings, loading: trainingsLoading, error: trainingsError, refetch } = useTrainings(true);
  const { facilities: facilitiesData } = useFacilities();
  const [selectedTrainings, setSelectedTrainings] = useState<Set<string>>(new Set());
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  // Create a map of facility code to name for display
  const facilityNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    facilitiesData.forEach(f => {
      map[f.code] = f.name;
    });
    return map;
  }, [facilitiesData]);

  // Helper to get facility name from code
  const getFacilityName = (code: string): string => {
    return facilityNameMap[code] || code;
  };

  const {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    saveCurrentFilters,
    loadSavedFilter,
    deleteSavedFilter,
    savedFilters,
  } = useAdvancedFilters("scheduled-trainings-filters");

  // Get unique values for filters from real data
  const departments = useMemo(() => {
    const depts = new Set(trainings.map((t) => t.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [trainings]);

  const facilityCodes = useMemo(() => {
    const facilitySet = new Set(trainings.map((t) => t.facility).filter(Boolean));
    return Array.from(facilitySet).sort();
  }, [trainings]);

  // Convert facility codes to names for filter display
  const facilities = useMemo(() => {
    return facilityCodes.map(code => getFacilityName(code)).sort();
  }, [facilityCodes, facilityNameMap]);

  const trainingTypes = useMemo(() => {
    const types = new Set(trainings.map((t) => t.type).filter(Boolean));
    return Array.from(types).sort();
  }, [trainings]);

  const trainers = useMemo(() => {
    const trainerSet = new Set(trainings.map((t) => t.trainer).filter(Boolean));
    return Array.from(trainerSet).sort();
  }, [trainings]);

  // Filter data
  const filteredTrainings = useMemo(() => {
    return trainings.filter((training) => {
      const searchLower = filters.searchQuery.toLowerCase();
      const matchesSearch =
        filters.searchQuery === "" ||
        training.employeeName.toLowerCase().includes(searchLower) ||
        training.employeeNumber.includes(searchLower) ||
        training.type.toLowerCase().includes(searchLower) ||
        training.department.toLowerCase().includes(searchLower) ||
        training.trainer.toLowerCase().includes(searchLower);

      const matchesStatus =
        filters.statusFilter === "all" || training.status === filters.statusFilter;
      const matchesFacility =
        filters.facilityFilter === "all" || getFacilityName(training.facility) === filters.facilityFilter;
      const matchesDepartment =
        filters.departmentFilter === "all" ||
        training.department === filters.departmentFilter;
      const matchesType =
        filters.typeFilter === "all" || training.type === filters.typeFilter;
      const matchesTrainer =
        filters.trainerFilter === "all" || training.trainer === filters.trainerFilter;

      const trainingDate = new Date(training.date);
      const matchesDateFrom =
        !filters.dateFrom || trainingDate >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || trainingDate <= filters.dateTo;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFacility &&
        matchesDepartment &&
        matchesType &&
        matchesTrainer &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [filters, trainings]);

  const toggleSelectAll = () => {
    if (selectedTrainings.size === filteredTrainings.length) {
      setSelectedTrainings(new Set());
    } else {
      setSelectedTrainings(new Set(filteredTrainings.map(t => t.id)));
    }
  };

  const toggleSelectTraining = (id: string) => {
    const newSelected = new Set(selectedTrainings);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTrainings(newSelected);
  };

  const handleBulkEdit = () => {
    if (selectedTrainings.size === 0) {
      toast({
        title: "Žádná školení vybrána",
        description: "Vyberte alespoň jedno školení pro hromadnou úpravu.",
        variant: "destructive",
      });
      return;
    }
    setBulkEditDialogOpen(true);
  };

  const handleBulkArchive = () => {
    if (selectedTrainings.size === 0) {
      toast({
        title: "Žádná školení vybrána",
        description: "Vyberte alespoň jedno školení pro archivaci.",
        variant: "destructive",
      });
      return;
    }

    setDeleteDialogOpen(true);
  };

  const confirmBulkArchive = async () => {
    if (selectedTrainings.size === 0) {
      return;
    }

    setLoading(true);
    
    try {
      const selectedIds = Array.from(selectedTrainings);
      
      // Soft-delete: set deleted_at timestamp instead of hard delete
      const { error } = await supabase
        .from("trainings")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .in("id", selectedIds);

      if (error) throw error;
      
      toast({
        title: "Školení archivována",
        description: `Úspěšně archivováno ${selectedTrainings.size} školení. Jsou stále dostupná v Historii školení.`,
      });

      setSelectedTrainings(new Set());
      setDeleteDialogOpen(false);
      
      refetch();
    } catch (error: any) {
      console.error("Error in bulk archive:", error);
      toast({
        title: "Chyba při archivaci",
        description: error.message || "Nepodařilo se archivovat školení.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectExpiringTrainings = (daysAhead: number = 30) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysAhead);
    
    const expiringIds = filteredTrainings
      .filter(training => {
        const trainingDate = new Date(training.date);
        trainingDate.setHours(0, 0, 0, 0);
        return trainingDate >= today && trainingDate <= targetDate;
      })
      .map(t => t.id);
    
    setSelectedTrainings(new Set(expiringIds));
    
    toast({
      title: "Výběr dokončen",
      description: `Vybráno ${expiringIds.length} školení expirujících do ${daysAhead} dní.`,
    });
  };

  const selectedTrainingDetails = useMemo(() => {
    return filteredTrainings.filter(t => selectedTrainings.has(t.id));
  }, [selectedTrainings, filteredTrainings]);

  const exportToCSV = () => {
    try {
      const trainingsToExport = selectedTrainings.size > 0
        ? filteredTrainings.filter(t => selectedTrainings.has(t.id))
        : filteredTrainings;

      if (trainingsToExport.length === 0) {
        toast({
          title: "Žádná data k exportu",
          description: "Nejsou k dispozici žádná školení pro export.",
          variant: "destructive",
        });
        return;
      }

      const data = trainingsToExport.map(training => ({
        "Stav": training.status === "valid" ? "Platné" : training.status === "warning" ? "Brzy vyprší" : "Prošlé",
        "Školení platné do": new Date(training.date).toLocaleDateString("cs-CZ"),
        "Typ školení": training.type || "",
        "Osobní číslo": training.employeeNumber || "",
        "Jméno": training.employeeName || "",
        "Provozovna": getFacilityName(training.facility) || "",
        "Středisko": training.department || "",
        "Datum školení": new Date(training.lastTrainingDate).toLocaleDateString("cs-CZ"),
        "Školitel": training.trainer || "",
        "Firma": training.company || "",
        "Zadavatel": training.requester || "",
        "Periodicita": formatPeriodicity(training.period) || "",
        "Poznámka": training.note || "",
      }));

      const csv = Papa.unparse(data, { delimiter: ";" });
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `skoleni_export_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${trainingsToExport.length} školení.`,
      });
    } catch (error) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  // exportToExcel replaced with exportToCSV above

  const exportToPDF = () => {
    try {
      const trainingsToExport = selectedTrainings.size > 0
        ? filteredTrainings.filter(t => selectedTrainings.has(t.id))
        : filteredTrainings;

      if (trainingsToExport.length === 0) {
        toast({
          title: "Žádná data k exportu",
          description: "Nejsou k dispozici žádná školení pro export.",
          variant: "destructive",
        });
        return;
      }

      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;

      pdf.setFontSize(18);
      pdf.text('Seznam skoleni', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      pdf.setFontSize(10);
      const date = new Date().toLocaleDateString('cs-CZ');
      pdf.text(`Vygenerovano: ${date}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      const statusMap = {
        valid: "Platne",
        warning: "Brzy vyprsi",
        expired: "Prosle"
      };

      autoTable(pdf, {
        startY: yPosition,
        head: [['Stav', 'Platne do', 'Typ', 'Cislo', 'Jmeno', 'Stredisko', 'Skolitel', 'Firma']],
        body: trainingsToExport.map(t => [
          statusMap[t.status],
          new Date(t.date).toLocaleDateString("cs-CZ"),
          t.type,
          t.employeeNumber,
          t.employeeName,
          t.department,
          t.trainer || '-',
          t.company || '-'
        ]),
        theme: 'striped',
        headStyles: { 
          fillColor: [66, 66, 66],
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8
        },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 25 },
          2: { cellWidth: 45 },
          3: { cellWidth: 20 },
          4: { cellWidth: 40 },
          5: { cellWidth: 30 },
          6: { cellWidth: 35 },
          7: { cellWidth: 35 }
        },
        margin: { left: 10, right: 10 },
      });

      const timestamp = new Date().toISOString().split('T')[0];
      pdf.save(`skoleni_export_${timestamp}.pdf`);

      toast({
        title: "Export dokončen",
        description: `Exportováno ${trainingsToExport.length} školení.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data do PDF.",
        variant: "destructive",
      });
    }
  };

  if (trainingsError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Naplánovaná školení</h2>
        </div>
        <ErrorDisplay
          title="Nepodařilo se načíst školení"
          message={trainingsError}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (trainingsLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <TableSkeleton columns={10} rows={8} />
      </div>
    );
  }

  return (
    <>
      {previewFile && (
        <FilePreviewDialog
          open={true}
          onOpenChange={(open) => !open && setPreviewFile(null)}
          file={previewFile}
        />
      )}
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Naplánovaná školení</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Obnovit
            </Button>
            <Button 
              variant="outline" 
              onClick={() => selectExpiringTrainings(30)}
              title="Vybrat všechna školení, která vyprší do 30 dní"
            >
              <CalendarClock className="w-4 h-4 mr-2" />
              Vybrat expirující (30 dní)
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              {selectedTrainings.size > 0 
                ? `Export CSV (${selectedTrainings.size})`
                : "Export CSV"
              }
            </Button>
            <Button variant="outline" onClick={exportToPDF}>
              <FileDown className="w-4 h-4 mr-2" />
              {selectedTrainings.size > 0 
                ? `Export PDF (${selectedTrainings.size})`
                : "Export PDF"
              }
            </Button>
            {/* Tlačítko pro vytvoření školení - pouze admin a manažer */}
            {canEdit && (
              <Button onClick={() => navigate("/new-training")}>
                <Plus className="w-4 h-4 mr-2" />
                Nové školení
              </Button>
            )}
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {canEdit && (
          <BulkActionsBar
            selectedCount={selectedTrainings.size}
            onClearSelection={() => setSelectedTrainings(new Set())}
            onBulkEdit={handleBulkEdit}
            onBulkArchive={handleBulkArchive}
            entityName="školení"
          />
        )}

        {/* Bulk Edit Dialog */}
        <BulkEditTrainingsDialog
          open={bulkEditDialogOpen}
          onOpenChange={setBulkEditDialogOpen}
          selectedIds={Array.from(selectedTrainings)}
          onSuccess={() => {
            setSelectedTrainings(new Set());
            refetch();
          }}
        />

        {/* Bulk Archive Dialog */}
        <BulkArchiveDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          selectedCount={selectedTrainings.size}
          onConfirm={confirmBulkArchive}
          loading={loading}
          entityName="školení"
        />

        {/* Advanced filters */}
        <AdvancedFilters
          filters={filters}
          onFilterChange={updateFilter}
          onClearFilters={clearFilters}
          onSaveFilters={saveCurrentFilters}
          onLoadFilter={loadSavedFilter}
          onDeleteFilter={deleteSavedFilter}
          savedFilters={savedFilters}
          hasActiveFilters={hasActiveFilters}
          departments={departments}
          facilities={facilities}
          trainingTypes={trainingTypes}
          trainers={trainers}
          resultCount={filteredTrainings.length}
          totalCount={trainings.length}
        />

        {/* Legend + Count - above the table */}
        <div className="flex items-center justify-between">
          <StatusLegend variant="training" />
          <p className="text-sm text-muted-foreground">
            Celkem: {filteredTrainings.length} školení
          </p>
        </div>

        <Card className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Checkbox pouze pro admin a manažera */}
                  {canEdit && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          filteredTrainings.length > 0 &&
                          selectedTrainings.size === filteredTrainings.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>Stav</TableHead>
                  <TableHead>Školení platné do</TableHead>
                  <TableHead>Typ školení</TableHead>
                  
                  <TableHead>Jméno</TableHead>
                  <TableHead>Provozovna</TableHead>
                  <TableHead>Středisko</TableHead>
                  <TableHead>Datum školení</TableHead>
                  <TableHead>Školitel</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Zadavatel</TableHead>
                  <TableHead>Periodicita</TableHead>
                  <TableHead>Poznámka</TableHead>
                  <TableHead className="text-center">Protokol</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrainings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 15 : 14} className="text-center py-8 text-muted-foreground">
                      Žádná školení nenalezena
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTrainings.map((training) => (
                    <TableRow key={training.id}>
                      {/* Checkbox pouze pro admin a manažera */}
                      {canEdit && (
                        <TableCell>
                          <Checkbox
                            checked={selectedTrainings.has(training.id)}
                            onCheckedChange={() => toggleSelectTraining(training.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <StatusBadge status={training.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(training.date).toLocaleDateString("cs-CZ")}
                      </TableCell>
                      <TableCell className="font-medium">{training.type}</TableCell>
                      
                      <TableCell className="whitespace-nowrap">{training.employeeName}</TableCell>
                      <TableCell className="max-w-xs truncate" title={getFacilityName(training.facility)}>
                        {getFacilityName(training.facility)}
                      </TableCell>
                      <TableCell>{training.department}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(training.lastTrainingDate).toLocaleDateString("cs-CZ")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{training.trainer}</TableCell>
                      <TableCell className="whitespace-nowrap">{training.company}</TableCell>
                      <TableCell className="whitespace-nowrap">{training.requester}</TableCell>
                      <TableCell className="text-center">
                        {formatPeriodicity(training.period)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={training.note}>
                        {training.note || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <TrainingProtocolCell trainingId={training.id} />
                      </TableCell>
                      <TableCell>
                        {/* Admin a manažer mohou editovat, ostatní jen náhled */}
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/edit-training/${training.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/edit-training/${training.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

      </div>
    </>
  );
}
