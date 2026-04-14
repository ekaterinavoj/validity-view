import { useState, useMemo } from "react";
import { TypePeriodicityCell, formatPeriodicityDual } from "@/components/TypePeriodicityCell";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dateFormat";
import { RefreshCw, Download, ArchiveRestore, History as HistoryIcon, Archive } from "lucide-react";
import { ExpandableToggle, ExpandableDetailRow } from "@/components/ExpandableRowDetail";
import { formatPeriodicity } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDeadlineHistory } from "@/hooks/useDeadlineHistory";
import { useFacilities } from "@/hooks/useFacilities";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Papa from "papaparse";
import { useAuth } from "@/contexts/AuthContext";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkArchiveDialog } from "@/components/BulkArchiveDialog";
import { NoteTooltipText } from "@/components/NoteTooltipText";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";

export default function DeadlineHistory() {
  const { history, loading: isLoading, error, refetch } = useDeadlineHistory(true);
  const { facilities } = useFacilities();
  const { toast } = useToast();
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const canBulkActions = isAdmin; // Only admins can do bulk actions in history
  const [archiveFilter, setArchiveFilter] = useState<string>("active");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRestoreDialogOpen, setBulkRestoreDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const facilityNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    facilities.forEach(f => { map[f.code] = f.name; });
    return map;
  }, [facilities]);

  const getFacilityName = (code: string): string => facilityNameMap[code] || code;

  const facilityList = useMemo(() => 
    facilities.map(f => f.name),
    [facilities]
  );

  const deadlineTypeList = useMemo(() => {
    const types = new Set<string>();
    history.forEach(d => {
      if (d.deadline_type?.name) types.add(d.deadline_type.name);
    });
    return Array.from(types);
  }, [history]);

  const performerList = useMemo(() => {
    const performers = new Set<string>();
    history.forEach(d => {
      if (d.performer) performers.add(d.performer);
    });
    return Array.from(performers);
  }, [history]);

  const { 
    filters, 
    updateFilter, 
    clearFilters, 
    hasActiveFilters,
    saveCurrentFilters,
    loadSavedFilter,
    deleteSavedFilter,
    savedFilters
  } = useAdvancedFilters("deadline-history-filters");

  const filteredHistory = useMemo(() => {
    return history.filter(d => {
      // Archive/version filter
      if (archiveFilter === "active" && (d.deleted_at || d.isVersion)) return false;
      if (archiveFilter === "archived" && !d.isArchived) return false;
      if (archiveFilter === "versions" && !d.isVersion) return false;

      if (filters.facilityFilter !== "all" && getFacilityName(d.facility) !== filters.facilityFilter) return false;
      if (filters.typeFilter !== "all" && d.deadline_type?.name !== filters.typeFilter) return false;
      if (filters.trainerFilter !== "all" && d.performer !== filters.trainerFilter) return false;
      if (filters.statusFilter !== "all" && d.status !== filters.statusFilter) return false;
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesEquipment = d.equipment?.name.toLowerCase().includes(query) ||
          d.equipment?.inventory_number.toLowerCase().includes(query);
        const matchesType = d.deadline_type?.name.toLowerCase().includes(query);
        if (!matchesEquipment && !matchesType) return false;
      }
      if (filters.dateFrom && new Date(d.last_check_date) < filters.dateFrom) return false;
      if (filters.dateTo && new Date(d.last_check_date) > filters.dateTo) return false;
      
      return true;
    });
  }, [history, filters, archiveFilter]);

  const { preferences } = useUserPreferences();
  const { currentPage, setCurrentPage, totalPages, paginatedItems: paginatedHistory, totalItems } = usePagination(filteredHistory, preferences.itemsPerPage);

  // Get only archived items for selection (not version snapshots)
  const archivedItems = useMemo(() => 
    filteredHistory.filter(d => d.isArchived && !d.isVersion),
    [filteredHistory]
  );

  const handleSelectAll = () => {
    if (selectedIds.length === archivedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(archivedItems.map(d => d.id));
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      const { error } = await supabase
        .from("deadlines")
        .update({ deleted_at: null, is_active: true })
        .eq("id", id);

      if (error) throw error;
      
      toast({ title: "Událost byla obnovena" });
      refetch();
    } catch (err) {
      toast({
        title: "Chyba při obnovování",
        description: (err as Error).message,
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
        .from("deadlines")
        .update({ deleted_at: null, is_active: true })
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: "Události obnoveny",
        description: `Bylo obnoveno ${selectedIds.length} událostí.`,
      });

      setSelectedIds([]);
      setBulkRestoreDialogOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: "Chyba při obnovení",
        description: err.message || "Nepodařilo se obnovit události.",
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
        .from("deadline_documents")
        .delete()
        .in("deadline_id", selectedIds);

      // Delete related reminder logs
      await supabase
        .from("deadline_reminder_logs")
        .delete()
        .in("deadline_id", selectedIds);

      // Delete related responsibles
      await supabase
        .from("deadline_responsibles")
        .delete()
        .in("deadline_id", selectedIds);

      // Now delete the deadlines themselves
      const { error } = await supabase
        .from("deadlines")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: "Události smazány",
        description: `Bylo trvale smazáno ${selectedIds.length} událostí.`,
      });

      setSelectedIds([]);
      setBulkDeleteDialogOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: "Chyba při mazání",
        description: err.message || "Nepodařilo se smazat události.",
        variant: "destructive",
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const exportToCSV = () => {
    const data = history.map(d => ({
      "Inventární č.": d.equipment?.inventory_number || "",
      "Zařízení": d.equipment?.name || "",
      "Typ události": d.deadline_type?.name || "",
      "Provozovna": getFacilityName(d.facility),
      "Poslední kontrola": formatDisplayDate(d.last_check_date, ""),
      "Příští kontrola": formatDisplayDate(d.next_check_date, ""),
      "Stav": d.status === "valid" ? "Platná" : d.status === "warning" ? "Brzy vyprší" : "Prošlá",
      "Provádějící": d.performer || "",
      "Firma": d.company || "",
      "Archivováno": d.deleted_at ? "Ano" : "Ne",
    }));
    
    const csv = Papa.unparse(data, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `historie-udalosti-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  if (error) {
    return <ErrorDisplay title="Chyba při načítání historie" message={error} onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return <TableSkeleton columns={9} rows={10} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historie technických událostí</h1>
          <p className="text-muted-foreground">
            Celkem {filteredHistory.length} záznamů
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={archiveFilter} onValueChange={setArchiveFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vše</SelectItem>
              <SelectItem value="active">Aktivní</SelectItem>
              <SelectItem value="versions">Předchozí verze</SelectItem>
              <SelectItem value="archived">Archivované</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <AdvancedFilters
        filters={filters}
        onFilterChange={updateFilter}
        onClearFilters={clearFilters}
        onSaveFilters={saveCurrentFilters}
        onLoadFilter={loadSavedFilter}
        onDeleteFilter={deleteSavedFilter}
        savedFilters={savedFilters}
        hasActiveFilters={hasActiveFilters}
        departments={[]}
        facilities={facilityList}
        trainingTypes={deadlineTypeList}
        trainers={performerList}
        trainerLabel="performers"
        resultCount={filteredHistory.length}
        totalCount={history.length}
      />

      {/* Bulk Actions Bar - only for admins when viewing archived */}
      {canBulkActions && archiveFilter === "archived" && archivedItems.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.length}
          onClearSelection={() => setSelectedIds([])}
          onBulkRestore={() => setBulkRestoreDialogOpen(true)}
          onBulkDelete={() => setBulkDeleteDialogOpen(true)}
          entityName="událostí"
        />
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                {canBulkActions && archiveFilter === "archived" && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={archivedItems.length > 0 && selectedIds.length === archivedItems.length}
                      onCheckedChange={handleSelectAll}
                      aria-label="Vybrat vše"
                    />
                  </TableHead>
                )}
                <TableHead>Inventární č.</TableHead>
                <TableHead>Zařízení</TableHead>
                <TableHead>Typ události</TableHead>
                <TableHead>Provozovna</TableHead>
                <TableHead>Poslední kontrola</TableHead>
                <TableHead>Příští kontrola</TableHead>
                <TableHead>Provádějící</TableHead>
                <TableHead>Poznámka</TableHead>
                <TableHead>Typ záznamu</TableHead>
                {canEdit && archiveFilter === "archived" && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canBulkActions && archiveFilter !== "active" ? 12 : 11} className="text-center py-8 text-muted-foreground">
                    Nebyly nalezeny žádné záznamy
                  </TableCell>
                </TableRow>
              ) : (
                paginatedHistory.map(deadline => {
                  const isExpanded = expandedRowId === deadline.id;
                  return (
                    <>
                    <TableRow 
                      key={deadline.id}
                      className={cn(
                        deadline.isVersion && "bg-blue-50/50 dark:bg-blue-950/20",
                        deadline.isArchived && !deadline.isVersion && "opacity-60"
                      )}
                    >
                      <TableCell className="w-[40px] px-2">
                        <ExpandableToggle
                          isExpanded={isExpanded}
                          onToggle={() => setExpandedRowId(isExpanded ? null : deadline.id)}
                        />
                      </TableCell>
                    {canBulkActions && archiveFilter === "archived" && (
                      <TableCell>
                        {deadline.isArchived && !deadline.isVersion && (
                          <Checkbox
                            checked={selectedIds.includes(deadline.id)}
                            onCheckedChange={() => handleSelectItem(deadline.id)}
                            aria-label={`Vybrat ${deadline.equipment?.name}`}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-sm">
                      {deadline.equipment?.inventory_number}
                    </TableCell>
                    <TableCell className="font-medium">
                      {deadline.equipment?.name}
                    </TableCell>
                    <TableCell>
                      <TypePeriodicityCell typeName={deadline.deadline_type?.name || ""} periodDays={deadline.deadline_type?.period_days ?? 365} description={deadline.deadline_type?.description || undefined} />
                    </TableCell>
                    <TableCell>{getFacilityName(deadline.facility)}</TableCell>
                    <TableCell>
                      {formatDisplayDate(deadline.last_check_date)}
                    </TableCell>
                    <TableCell>
                      {formatDisplayDate(deadline.next_check_date)}
                    </TableCell>
                    <TableCell>{deadline.performer || "-"}</TableCell>
                    <TableCell>
                      <NoteTooltipText note={deadline.note} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {deadline.isVersion ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            <HistoryIcon className="w-3 h-3 mr-1" />
                            Předchozí verze
                          </Badge>
                        ) : deadline.isArchived ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            <Archive className="w-3 h-3 mr-1" />
                            Archivováno
                          </Badge>
                        ) : (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              deadline.status === "valid" && "bg-green-500/20 text-green-700 dark:text-green-300",
                              deadline.status === "warning" && "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
                              deadline.status === "expired" && "bg-red-500/20 text-red-700 dark:text-red-300"
                            )}
                          >
                            {deadline.status === "valid" ? "Platná" : 
                             deadline.status === "warning" ? "Varování" : "Prošlá"}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    {canEdit && archiveFilter === "archived" && (
                      <TableCell>
                        {deadline.isArchived && !deadline.isVersion && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestore(deadline.id)}
                            disabled={restoringId === deadline.id}
                          >
                            <ArchiveRestore className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                    </TableRow>
                    {isExpanded && (
                      <ExpandableDetailRow
                        colSpan={12}
                        fields={[
                          { label: "Periodicita", value: formatPeriodicity(deadline.period) },
                          { label: "Typ zařízení", value: deadline.equipment?.equipment_type },
                          { label: "Výrobce", value: deadline.equipment?.manufacturer },
                          { label: "Model", value: deadline.equipment?.model },
                          { label: "Firma", value: deadline.company },
                          { label: "Zadavatel", value: deadline.requester },
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
        </CardContent>
      </Card>

      {/* Bulk Restore Dialog */}
      <BulkArchiveDialog
        open={bulkRestoreDialogOpen}
        onOpenChange={setBulkRestoreDialogOpen}
        selectedCount={selectedIds.length}
        onConfirm={handleBulkRestore}
        loading={bulkActionLoading}
        mode="restore"
        entityName="událostí"
      />

      {/* Bulk Delete Dialog */}
      <BulkArchiveDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        selectedCount={selectedIds.length}
        onConfirm={handleBulkDelete}
        loading={bulkActionLoading}
        mode="delete"
        entityName="událostí"
      />
    </div>
  );
}
