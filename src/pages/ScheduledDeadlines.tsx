import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useSortable } from "@/hooks/useSortable";
import { SortableTableHead } from "@/components/SortableTableHead";
import { format } from "date-fns";
import {
  RefreshCw,
  Download,
  PlusCircle,
  Edit,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useDeadlines } from "@/hooks/useDeadlines";
import { useFacilities } from "@/hooks/useFacilities";
import { useAllEquipmentResponsibles } from "@/hooks/useEquipmentResponsibles";
import { useDeadlineResponsiblesBatch } from "@/hooks/useDeadlineResponsibles";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { DeadlineProtocolCell } from "@/components/DeadlineProtocolCell";
import { DeadlineResponsiblesBadges } from "@/components/DeadlineResponsiblesBadges";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusLegend } from "@/components/StatusLegend";
import { ResultBadge, getResultLabel } from "@/components/ResultBadge";
import { NoteTooltipText } from "@/components/NoteTooltipText";
import { ExpandableToggle, ExpandableDetailRow } from "@/components/ExpandableRowDetail";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkEditDeadlinesDialog } from "@/components/BulkEditDeadlinesDialog";
import { BulkArchiveDialog } from "@/components/BulkArchiveDialog";
import { cn, formatPeriodicity } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import { useAuth } from "@/contexts/AuthContext";

export default function ScheduledDeadlines() {
  const { toast } = useToast();
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const { deadlines, isLoading, error, refetch, archiveDeadline, isArchiving } = useDeadlines();
  const { facilities } = useFacilities();
  const { uniqueProfiles, getEquipmentIdsByProfile } = useAllEquipmentResponsibles();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const filteredDeadlineIds = useMemo(() => {
    return deadlines.filter(d => d.is_active).map(d => d.id);
  }, [deadlines]);
  const { data: responsiblesMap } = useDeadlineResponsiblesBatch(filteredDeadlineIds);

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
    deadlines.forEach(d => {
      if (d.deadline_type?.name) types.add(d.deadline_type.name);
    });
    return Array.from(types);
  }, [deadlines]);

  const performerList = useMemo(() => {
    const performers = new Set<string>();
    deadlines.forEach(d => {
      if (d.performer) performers.add(d.performer);
    });
    return Array.from(performers);
  }, [deadlines]);

  const { 
    filters, 
    updateFilter, 
    clearFilters, 
    hasActiveFilters,
    saveCurrentFilters,
    loadSavedFilter,
    deleteSavedFilter,
    savedFilters
  } = useAdvancedFilters("deadline-filters");

  const filteredDeadlines = useMemo(() => {
    return deadlines.filter(d => {
      if (!d.is_active) return false;
      
      if (filters.facilityFilter !== "all" && getFacilityName(d.facility) !== filters.facilityFilter) return false;
      if (filters.typeFilter !== "all" && d.deadline_type?.name !== filters.typeFilter) return false;
      if (filters.trainerFilter !== "all" && d.performer !== filters.trainerFilter) return false;
      if (filters.statusFilter !== "all" && d.status !== filters.statusFilter) return false;
      
      if (filters.responsibleFilter !== "all") {
        const equipmentIds = getEquipmentIdsByProfile(filters.responsibleFilter);
        if (!equipmentIds.includes(d.equipment_id)) return false;
      }
      
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesEquipment = d.equipment?.name.toLowerCase().includes(query) ||
          d.equipment?.inventory_number.toLowerCase().includes(query);
        const matchesType = d.deadline_type?.name.toLowerCase().includes(query);
        if (!matchesEquipment && !matchesType) return false;
      }
      if (filters.dateFrom && new Date(d.next_check_date) < filters.dateFrom) return false;
      if (filters.dateTo && new Date(d.next_check_date) > filters.dateTo) return false;
      
      return true;
    });
  }, [deadlines, filters, getEquipmentIdsByProfile]);

  const { sortedData: sortedDeadlines, sortConfig, requestSort } = useSortable(filteredDeadlines);

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? filteredDeadlines.map(d => d.id) : []);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => 
      checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  const handleBulkEdit = () => {
    setBulkEditDialogOpen(true);
  };

  const handleBulkArchive = () => {
    setArchiveDialogOpen(true);
  };

  const confirmBulkArchive = async () => {
    if (selectedIds.length === 0) return;

    setArchiveLoading(true);
    try {
      const { error } = await supabase
        .from("deadlines")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .in("id", selectedIds);

      if (error) throw error;

      toast({
        title: "Události archivovány",
        description: `Úspěšně archivováno ${selectedIds.length} událostí.`,
      });

      setSelectedIds([]);
      setArchiveDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: "Chyba při archivaci",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setArchiveLoading(false);
    }
  };

  const exportToCSV = () => {
    const dataToExport = selectedIds.length > 0
      ? filteredDeadlines.filter(d => selectedIds.includes(d.id))
      : filteredDeadlines;

    const data = dataToExport.map(d => {
      const resps = responsiblesMap?.get(d.id) ?? [];
      const responsibleNames = resps.map(r => r.name).join(", ");
      return {
        "Stav": d.status === "valid" ? "Platná" : d.status === "warning" ? "Brzy vyprší" : "Prošlá",
        "Výsledek": getResultLabel((d.result as any) || "passed", "deadline"),
        "Inventární č.": d.equipment?.inventory_number || "",
        "Zařízení": d.equipment?.name || "",
        "Typ zařízení": d.equipment?.equipment_type || "",
        "Výrobce": d.equipment?.manufacturer || "",
        "Model": d.equipment?.model || "",
        "Typ události": d.deadline_type?.name || "",
        "Provozovna": getFacilityName(d.facility),
        "Poslední kontrola": format(new Date(d.last_check_date), "dd.MM.yyyy"),
        "Příští kontrola": format(new Date(d.next_check_date), "dd.MM.yyyy"),
        "Provádějící": d.performer || "",
        "Firma": d.company || "",
        "Zadavatel": d.requester || "",
        "Odpovědní": responsibleNames || "",
        "Poznámka": d.note || "",
      };
    });
    
    const csv = Papa.unparse(data, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `technicke-udalosti-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  // expand + checkbox? + stav + inv.č. + zařízení + typ události + poslední + příští + provádějící + odpovědní + výsledek + poznámka + protokol + akce = 13 or 14
  const totalColumns = canEdit ? 14 : 13;

  if (error) {
    return <ErrorDisplay title="Chyba při načítání technických událostí" message={error.message} onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return <TableSkeleton columns={8} rows={10} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Naplánované události</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {canEdit && (
            <Link to="/deadlines/new">
              <Button size="sm">
                <PlusCircle className="w-4 h-4 mr-2" />
                Nová událost
              </Button>
            </Link>
          )}
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
        responsiblePersons={uniqueProfiles.map(p => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
        }))}
        resultCount={filteredDeadlines.length}
        totalCount={deadlines.length}
      />

      {canEdit && (
        <BulkActionsBar
          selectedCount={selectedIds.length}
          onClearSelection={() => setSelectedIds([])}
          onBulkEdit={handleBulkEdit}
          onBulkArchive={handleBulkArchive}
          entityName="událostí"
        />
      )}

      <div className="flex items-center justify-between">
        <StatusLegend variant="deadline" />
        <p className="text-sm text-muted-foreground">
          Celkem: {filteredDeadlines.length} událostí
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                {canEdit && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === filteredDeadlines.length && filteredDeadlines.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <SortableTableHead label="Stav" sortKey="status" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Inventární č." sortKey="equipment.inventory_number" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Zařízení" sortKey="equipment.name" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Typ události" sortKey="deadline_type.name" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Provozovna" sortKey="facility" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Poslední" sortKey="last_check_date" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Příští" sortKey="next_check_date" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Provádějící" sortKey="performer" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <TableHead>Odpovědní</TableHead>
                <TableHead>Výsledek</TableHead>
                <TableHead>Poznámka</TableHead>
                <TableHead>Protokol</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
             {sortedDeadlines.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={totalColumns} className="text-center py-8 text-muted-foreground">
                    Nebyly nalezeny žádné technické události
                  </TableCell>
                </TableRow>
              ) : (
                sortedDeadlines.map(deadline => {
                  const isExpanded = expandedRowId === deadline.id;
                  return (
                    <>
                      <TableRow 
                        key={deadline.id}
                        className={cn(
                          deadline.status === "expired" && "bg-destructive/5",
                          deadline.status === "warning" && "bg-accent/30"
                        )}
                      >
                        <TableCell className="w-[40px] px-2">
                          <ExpandableToggle
                            isExpanded={isExpanded}
                            onToggle={() => setExpandedRowId(isExpanded ? null : deadline.id)}
                          />
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(deadline.id)}
                              onCheckedChange={(checked) => handleSelectOne(deadline.id, !!checked)}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <StatusBadge status={deadline.status as "valid" | "warning" | "expired"} />
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {deadline.equipment?.inventory_number}
                        </TableCell>
                        <TableCell className="font-medium">
                          {deadline.equipment?.name}
                        </TableCell>
                        <TableCell>{deadline.deadline_type?.name}</TableCell>
                        <TableCell>{getFacilityName(deadline.facility)}</TableCell>
                        <TableCell>
                          {format(new Date(deadline.last_check_date), "dd.MM.yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {format(new Date(deadline.next_check_date), "dd.MM.yyyy")}
                        </TableCell>
                        <TableCell>{deadline.performer || "-"}</TableCell>
                        <TableCell>
                          <DeadlineResponsiblesBadges 
                            deadlineId={deadline.id} 
                            responsibles={responsiblesMap?.get(deadline.id) ?? []}
                          />
                        </TableCell>
                        <TableCell>
                          <ResultBadge 
                            result={(deadline.result as any) || "passed"} 
                            context="deadline" 
                            note={deadline.note || undefined} 
                          />
                        </TableCell>
                        <TableCell>
                          <NoteTooltipText note={deadline.note} />
                        </TableCell>
                        <TableCell>
                          <DeadlineProtocolCell deadlineId={deadline.id} />
                        </TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/deadlines/edit/${deadline.id}`}>
                                <Edit className="w-4 h-4" />
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/deadlines/edit/${deadline.id}`}>
                                <Eye className="w-4 h-4" />
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <ExpandableDetailRow
                          colSpan={totalColumns}
                          fields={[
                            { label: "Typ zařízení", value: deadline.equipment?.equipment_type },
                            { label: "Výrobce", value: deadline.equipment?.manufacturer },
                            { label: "Model", value: deadline.equipment?.model },
                            { label: "Periodicita", value: formatPeriodicity(deadline.period_days_override ?? deadline.deadline_type?.period_days ?? 365) },
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
        </CardContent>
      </Card>

      <BulkEditDeadlinesDialog
        open={bulkEditDialogOpen}
        onOpenChange={setBulkEditDialogOpen}
        selectedIds={selectedIds}
        onSuccess={() => {
          setSelectedIds([]);
          refetch();
        }}
      />

      <BulkArchiveDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        selectedCount={selectedIds.length}
        onConfirm={confirmBulkArchive}
        loading={archiveLoading}
        entityName="událostí"
      />
    </div>
  );
}
