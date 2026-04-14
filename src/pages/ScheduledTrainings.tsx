import { StatusBadge } from "@/components/StatusBadge";
import { TypePeriodicityCell, formatPeriodicityDual } from "@/components/TypePeriodicityCell";
import { ResultBadge, getResultLabel } from "@/components/ResultBadge";
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
import { Edit, Plus, CalendarClock, Eye, Download, Upload } from "lucide-react";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { ExpandableToggle, ExpandableDetailRow } from "@/components/ExpandableRowDetail";
import { useFacilities } from "@/hooks/useFacilities";
import { useMemo, useState } from "react";
import { useSortable } from "@/hooks/useSortable";
import { SortableTableHead } from "@/components/SortableTableHead";
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
// formatPeriodicity replaced by formatPeriodicityDual from TypePeriodicityCell
import { formatDisplayDate } from "@/lib/dateFormat";
import { useTrainings } from "@/hooks/useTrainings";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/LoadingSkeletons";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { RefreshCw } from "lucide-react";
import { DepartmentCell, formatDepartment } from "@/components/DepartmentCell";
import { useAuth } from "@/contexts/AuthContext";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkArchiveDialog } from "@/components/BulkArchiveDialog";
import { BulkEditTrainingsDialog } from "@/components/BulkEditTrainingsDialog";
import { NoteTooltipText } from "@/components/NoteTooltipText";
import { BulkTrainingImport } from "@/components/BulkTrainingImport";

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
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const facilityNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    facilitiesData.forEach(f => {
      map[f.code] = f.name;
    });
    return map;
  }, [facilitiesData]);

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

  const departments = useMemo(() => {
    const deptMap = new Map<string, string>();
    trainings.forEach((t) => {
      if (t.department) {
        const formatted = t.departmentName && t.departmentName !== t.department
          ? `${t.department} - ${t.departmentName}`
          : t.department;
        deptMap.set(formatted, formatted);
      }
    });
    return Array.from(deptMap.keys()).sort();
  }, [trainings]);

  const facilityCodes = useMemo(() => {
    const facilitySet = new Set(trainings.map((t) => t.facility).filter(Boolean));
    return Array.from(facilitySet).sort();
  }, [trainings]);

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
      const deptFormatted = training.departmentName && training.departmentName !== training.department
        ? `${training.department} - ${training.departmentName}`
        : training.department;
      const matchesDepartment =
        filters.departmentFilter === "all" ||
        deptFormatted === filters.departmentFilter;
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

  const { sortedData: sortedTrainings, sortConfig, requestSort } = useSortable(filteredTrainings);
  const { preferences } = useUserPreferences();
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems } = usePagination(sortedTrainings, preferences.itemsPerPage);

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
    if (selectedTrainings.size === 0) return;

    setLoading(true);
    
    try {
      const selectedIds = Array.from(selectedTrainings);
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
        ? trainings.filter(t => selectedTrainings.has(t.id))
        : trainings;

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
        "Výsledek": getResultLabel(training.result, "training"),
        "Školení platné do": formatDisplayDate(training.date, ""),
        "Typ školení": training.type || "",
        "Osobní číslo": training.employeeNumber || "",
        "Jméno": training.employeeName || "",
        "Provozovna": getFacilityName(training.facility) || "",
        "Středisko": formatDepartment(training.department, training.departmentName),
        "Datum školení": formatDisplayDate(training.lastTrainingDate, ""),
        "Školitel": training.trainer || "",
        "Firma": training.company || "",
        "Zadavatel": training.requester || "",
        "Periodicita": formatPeriodicityDual(training.period) || "",
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

  // expand + checkbox? + stav + platnost + typ + os.č. + jméno + středisko + datum + školitel + výsledek + poznámka + protokol + akce = 13 or 12
  const totalColumns = canEdit ? 13 : 12;

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
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setShowImport(!showImport)}>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
            )}
            {canEdit && (
              <Button onClick={() => navigate("/new-training")}>
                <Plus className="w-4 h-4 mr-2" />
                Nové školení
              </Button>
            )}
          </div>
        </div>

        {showImport && canEdit && (
          <BulkTrainingImport />
        )}

        {canEdit && (
          <BulkActionsBar
            selectedCount={selectedTrainings.size}
            onClearSelection={() => setSelectedTrainings(new Set())}
            onBulkEdit={handleBulkEdit}
            onBulkArchive={handleBulkArchive}
            entityName="školení"
          />
        )}

        <BulkEditTrainingsDialog
          open={bulkEditDialogOpen}
          onOpenChange={setBulkEditDialogOpen}
          selectedIds={Array.from(selectedTrainings)}
          onSuccess={() => {
            setSelectedTrainings(new Set());
            refetch();
          }}
        />

        <BulkArchiveDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          selectedCount={selectedTrainings.size}
          onConfirm={confirmBulkArchive}
          loading={loading}
          entityName="školení"
        />

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
                  <TableHead className="w-[40px]" />
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
                  <SortableTableHead label="Stav" sortKey="status" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                  <SortableTableHead label="Školení platné do" sortKey="date" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                  <SortableTableHead label="Typ školení" sortKey="type" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                  <SortableTableHead label="Os. číslo" sortKey="employeeNumber" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                  <SortableTableHead label="Jméno" sortKey="employeeName" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                  
                  <SortableTableHead label="Středisko" sortKey="department" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                  <SortableTableHead label="Datum školení" sortKey="lastTrainingDate" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                  <SortableTableHead label="Školitel" sortKey="trainer" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                  <TableHead>Výsledek</TableHead>
                  <TableHead>Poznámka</TableHead>
                  <TableHead className="text-center">Protokol</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTrainings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={totalColumns} className="text-center py-8 text-muted-foreground">
                      Žádná školení nenalezena
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((training) => {
                    const isExpanded = expandedRowId === training.id;
                    return (
                      <>
                        <TableRow key={training.id}>
                          <TableCell className="w-[40px] px-2">
                            <ExpandableToggle
                              isExpanded={isExpanded}
                              onToggle={() => setExpandedRowId(isExpanded ? null : training.id)}
                            />
                          </TableCell>
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
                            {formatDisplayDate(training.date)}
                          </TableCell>
                          <TableCell>
                            <TypePeriodicityCell typeName={training.type} periodDays={training.typePeriodDays} description={training.typeDescription} />
                          </TableCell>
                          <TableCell>{training.employeeNumber}</TableCell>
                          <TableCell className="whitespace-nowrap">{training.employeeName}</TableCell>
                          <TableCell><DepartmentCell code={training.department} name={training.departmentName} /></TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDisplayDate(training.lastTrainingDate)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{training.trainer}</TableCell>
                          <TableCell>
                            <ResultBadge 
                              result={training.result} 
                              context="training" 
                              note={training.note} 
                            />
                          </TableCell>
                          <TableCell>
                            <NoteTooltipText note={training.note} />
                          </TableCell>
                          <TableCell className="text-center">
                            <TrainingProtocolCell trainingId={training.id} />
                          </TableCell>
                          <TableCell>
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
                        {isExpanded && (
                          <ExpandableDetailRow
                            colSpan={totalColumns}
                            fields={[
                              { label: "Provozovna", value: getFacilityName(training.facility) },
                              { label: "Firma", value: training.company },
                              { label: "Zadavatel", value: training.requester },
                              { label: "Periodicita", value: formatPeriodicityDual(training.period) },
                              ...(training.typeDescription ? [{ label: "Popis typu", value: training.typeDescription }] : []),
                            ]}
                          />
                        )}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={preferences.itemsPerPage} onPageChange={setCurrentPage} />
        </Card>

      </div>
    </>
  );
}
