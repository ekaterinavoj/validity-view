import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Loader2, RefreshCw, ArchiveRestore, Archive } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTrainingHistory } from "@/hooks/useTrainingHistory";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { supabase } from "@/integrations/supabase/client";
import { useFacilities } from "@/hooks/useFacilities";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from "@/contexts/AuthContext";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkArchiveDialog } from "@/components/BulkArchiveDialog";

const employeeStatusLabels: Record<string, string> = {
  employed: "Aktivní",
  parental_leave: "Mateřská/rodičovská",
  sick_leave: "Nemocenská",
  terminated: "Ukončený",
};

const employeeStatusColors: Record<string, string> = {
  employed: "bg-green-500",
  parental_leave: "bg-blue-500",
  sick_leave: "bg-yellow-500",
  terminated: "bg-red-500",
};

export default function History() {
  const { toast } = useToast();
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const canBulkActions = isAdmin; // Only admins can do bulk actions in history
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<string>("all");
  const [archiveFilter, setArchiveFilter] = useState<string>("active"); // "all", "active", "archived"
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRestoreDialogOpen, setBulkRestoreDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  
  // Include archived trainings when filter is "all" or "archived"
  const includeArchived = archiveFilter === "all" || archiveFilter === "archived";
  const { trainings, loading, error, refetch } = useTrainingHistory(includeArchived);
  const { facilities: facilitiesData } = useFacilities();

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
  } = useAdvancedFilters("history-filters");

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

  const filteredHistory = useMemo(() => {
    return trainings.filter((training) => {
      // Archive filter
      if (archiveFilter === "active" && training.isArchived) return false;
      if (archiveFilter === "archived" && !training.isArchived) return false;

      // Employee status filter
      const matchesEmployeeStatus =
        employeeStatusFilter === "all" || training.employeeStatus === employeeStatusFilter;

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
      const matchesDateFrom = !filters.dateFrom || trainingDate >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || trainingDate <= filters.dateTo;

      return (
        matchesEmployeeStatus &&
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
  }, [filters, trainings, employeeStatusFilter, archiveFilter]);

  // Get only archived items for selection
  const archivedItems = useMemo(() => 
    filteredHistory.filter(t => t.isArchived),
    [filteredHistory]
  );

  const handleSelectAll = () => {
    if (selectedIds.length === archivedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(archivedItems.map(t => t.id));
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleRestoreTraining = async (trainingId: string) => {
    setRestoringId(trainingId);
    try {
      const { error } = await supabase
        .from("trainings")
        .update({ deleted_at: null })
        .eq("id", trainingId);

      if (error) throw error;

      toast({
        title: "Školení obnoveno",
        description: "Školení bylo úspěšně obnoveno a přesunuto zpět do aktivních.",
      });

      refetch();
    } catch (err: any) {
      toast({
        title: "Chyba při obnovení",
        description: err.message || "Nepodařilo se obnovit školení.",
        variant: "destructive",
      });
    } finally {
      setRestoringId(null);
    }
  };

  const handleBulkRestore = async () => {
    setBulkActionLoading(true);
    try {
      const { error } = await supabase
        .from("trainings")
        .update({ deleted_at: null })
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: "Školení obnovena",
        description: `Bylo obnoveno ${selectedIds.length} školení.`,
      });

      setSelectedIds([]);
      setBulkRestoreDialogOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: "Chyba při obnovení",
        description: err.message || "Nepodařilo se obnovit školení.",
        variant: "destructive",
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkActionLoading(true);
    try {
      // Delete related documents first
      await supabase
        .from("training_documents")
        .delete()
        .in("training_id", selectedIds);

      // Delete related reminder logs
      await supabase
        .from("reminder_logs")
        .delete()
        .in("training_id", selectedIds);

      // Now delete the trainings themselves
      const { error } = await supabase
        .from("trainings")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: "Školení smazána",
        description: `Bylo trvale smazáno ${selectedIds.length} školení.`,
      });

      setSelectedIds([]);
      setBulkDeleteDialogOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: "Chyba při mazání",
        description: err.message || "Nepodařilo se smazat školení.",
        variant: "destructive",
      });
    } finally {
      setBulkActionLoading(false);
    }
  };


  const exportToPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      
      doc.setFontSize(16);
      doc.text("Historie školení", 14, 15);
      doc.setFontSize(10);
      doc.text(`Vygenerováno: ${new Date().toLocaleDateString("cs-CZ")}`, 14, 22);

      const tableData = filteredHistory.map((training) => [
        new Date(training.date).toLocaleDateString("cs-CZ"),
        training.type,
        training.employeeNumber,
        training.employeeName,
        employeeStatusLabels[training.employeeStatus] || training.employeeStatus,
        training.department,
        training.trainer,
        training.company,
        training.note || "",
      ]);

      autoTable(doc, {
        head: [["Datum", "Typ školení", "Os. číslo", "Jméno", "Stav", "Středisko", "Školitel", "Firma", "Poznámka"]],
        body: tableData,
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      const timestamp = new Date().toISOString().split("T")[0];
      doc.save(`historie_skoleni_${timestamp}.pdf`);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${filteredHistory.length} záznamů do PDF.`,
      });
    } catch (err) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    try {
      const headers = [
        "Datum",
        "Typ školení",
        "Osobní číslo",
        "Jméno",
        "Stav zaměstnance",
        "Středisko",
        "Školitel",
        "Firma",
        "Poznámka",
      ];

      const rows = filteredHistory.map((training) => [
        new Date(training.date).toLocaleDateString("cs-CZ"),
        training.type,
        training.employeeNumber,
        training.employeeName,
        employeeStatusLabels[training.employeeStatus] || training.employeeStatus,
        training.department,
        training.trainer,
        training.company,
        training.note,
      ]);

      const escapeCSV = (value: string) => {
        if (value.includes(";") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csvContent = [
        headers.map(escapeCSV).join(";"),
        ...rows.map((row) => row.map(escapeCSV).join(";")),
      ].join("\n");

      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split("T")[0];
      link.setAttribute("href", url);
      link.setAttribute("download", `historie_export_${timestamp}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${filteredHistory.length} záznamů.`,
      });
    } catch (err) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Historie školení</h2>
        </div>
        <ErrorDisplay
          title="Nepodařilo se načíst historii"
          message={error}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Historie školení</h2>
        </div>
        <TableSkeleton columns={9} rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Historie školení</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Archiv:</label>
            <Select value={archiveFilter} onValueChange={setArchiveFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktivní školení</SelectItem>
                <SelectItem value="archived">Archivovaná</SelectItem>
                <SelectItem value="all">Vše</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Stav zaměstnance:</label>
            <Select value={employeeStatusFilter} onValueChange={setEmployeeStatusFilter}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všichni zaměstnanci</SelectItem>
                <SelectItem value="employed">Aktivní</SelectItem>
                <SelectItem value="parental_leave">Mateřská/rodičovská</SelectItem>
                <SelectItem value="sick_leave">Nemocenská</SelectItem>
                <SelectItem value="terminated">Ukončený</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

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
        resultCount={filteredHistory.length}
        totalCount={trainings.length}
      />

      {/* Bulk Actions Bar - only for admins when viewing archived */}
      {canBulkActions && archiveFilter !== "active" && archivedItems.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.length}
          onClearSelection={() => setSelectedIds([])}
          onBulkRestore={() => setBulkRestoreDialogOpen(true)}
          onBulkDelete={() => setBulkDeleteDialogOpen(true)}
          entityName="školení"
        />
      )}

      <Card className="p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {canBulkActions && archiveFilter !== "active" && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={archivedItems.length > 0 && selectedIds.length === archivedItems.length}
                      onCheckedChange={handleSelectAll}
                      aria-label="Vybrat vše"
                    />
                  </TableHead>
                )}
                <TableHead>Datum</TableHead>
                <TableHead>Typ školení</TableHead>
                <TableHead>Osobní číslo</TableHead>
                <TableHead>Jméno</TableHead>
                <TableHead>Stav zaměstnance</TableHead>
                <TableHead>Středisko</TableHead>
                <TableHead>Školitel</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Poznámka</TableHead>
                {(archiveFilter === "all" || archiveFilter === "archived") && (
                  <TableHead>Stav</TableHead>
                )}
                {canEdit && archiveFilter !== "active" && (
                  <TableHead>Akce</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={archiveFilter === "active" ? 10 : 13} className="text-center py-8 text-muted-foreground">
                    Žádná historie nenalezena
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((training) => (
                  <TableRow key={training.id} className={training.isArchived ? "bg-muted/50" : ""}>
                    {canBulkActions && archiveFilter !== "active" && (
                      <TableCell>
                        {training.isArchived && (
                          <Checkbox
                            checked={selectedIds.includes(training.id)}
                            onCheckedChange={() => handleSelectItem(training.id)}
                            aria-label={`Vybrat ${training.employeeName}`}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap">
                      {new Date(training.date).toLocaleDateString("cs-CZ")}
                    </TableCell>
                    <TableCell className="font-medium">{training.type}</TableCell>
                    <TableCell>{training.employeeNumber}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {training.employeeName}
                    </TableCell>
                    <TableCell>
                      <Badge className={employeeStatusColors[training.employeeStatus]}>
                        {employeeStatusLabels[training.employeeStatus] || training.employeeStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{training.department}</TableCell>
                    <TableCell className="whitespace-nowrap">{training.trainer}</TableCell>
                    <TableCell className="whitespace-nowrap">{training.company}</TableCell>
                    <TableCell>{training.note || "-"}</TableCell>
                    {(archiveFilter === "all" || archiveFilter === "archived") && (
                      <TableCell>
                        {training.isArchived ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            <Archive className="w-3 h-3 mr-1" />
                            Archivováno
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Aktivní
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {canEdit && archiveFilter !== "active" && (
                      <TableCell>
                        {training.isArchived && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreTraining(training.id)}
                            disabled={restoringId === training.id}
                          >
                            {restoringId === training.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <ArchiveRestore className="w-4 h-4 mr-1" />
                                Obnovit
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="font-medium">Stav zaměstnance:</span>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
          <span>Aktivní</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
          <span>Mateřská/rodičovská</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-500" />
          <span>Nemocenská</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
          <span>Ukončený</span>
        </div>
      </div>

      {/* Bulk Restore Dialog */}
      <BulkArchiveDialog
        open={bulkRestoreDialogOpen}
        onOpenChange={setBulkRestoreDialogOpen}
        selectedCount={selectedIds.length}
        onConfirm={handleBulkRestore}
        loading={bulkActionLoading}
        mode="restore"
        entityName="školení"
      />

      {/* Bulk Delete Dialog */}
      <BulkArchiveDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        selectedCount={selectedIds.length}
        onConfirm={handleBulkDelete}
        loading={bulkActionLoading}
        mode="delete"
        entityName="školení"
      />
    </div>
  );
}
