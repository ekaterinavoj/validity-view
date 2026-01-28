import { useState, useMemo } from "react";
import { format } from "date-fns";
import { RefreshCw, Download, ArchiveRestore } from "lucide-react";
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
import * as XLSX from "xlsx";

export default function DeadlineHistory() {
  const { history, isLoading, error, refetch } = useDeadlineHistory();
  const { facilities } = useFacilities();
  const { toast } = useToast();
  const [archiveFilter, setArchiveFilter] = useState<string>("active");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const facilityList = useMemo(() => 
    facilities.map(f => f.code),
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
      // Archive filter
      if (archiveFilter === "active" && d.deleted_at) return false;
      if (archiveFilter === "archived" && !d.deleted_at) return false;

      if (filters.facilityFilter !== "all" && d.facility !== filters.facilityFilter) return false;
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

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      const { error } = await supabase
        .from("deadlines")
        .update({ deleted_at: null })
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

  const exportToExcel = () => {
    const data = filteredHistory.map(d => ({
      "Inventární č.": d.equipment?.inventory_number || "",
      "Zařízení": d.equipment?.name || "",
      "Typ události": d.deadline_type?.name || "",
      "Provozovna": d.facility,
      "Poslední kontrola": format(new Date(d.last_check_date), "dd.MM.yyyy"),
      "Příští kontrola": format(new Date(d.next_check_date), "dd.MM.yyyy"),
      "Stav": d.status === "valid" ? "Platná" : d.status === "warning" ? "Brzy vyprší" : "Prošlá",
      "Provádějící": d.performer || "",
      "Firma": d.company || "",
      "Archivováno": d.deleted_at ? "Ano" : "Ne",
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historie událostí");
    XLSX.writeFile(wb, `historie-udalosti-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  if (error) {
    return <ErrorDisplay title="Chyba při načítání historie" message={error.message} onRetry={() => refetch()} />;
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
              <SelectItem value="archived">Archivované</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
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
        resultCount={filteredHistory.length}
        totalCount={history.length}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inventární č.</TableHead>
                <TableHead>Zařízení</TableHead>
                <TableHead>Typ události</TableHead>
                <TableHead>Provozovna</TableHead>
                <TableHead>Poslední kontrola</TableHead>
                <TableHead>Příští kontrola</TableHead>
                <TableHead>Provádějící</TableHead>
                <TableHead>Stav</TableHead>
                {archiveFilter !== "active" && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nebyly nalezeny žádné záznamy
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map(deadline => (
                  <TableRow 
                    key={deadline.id}
                    className={cn(deadline.deleted_at && "opacity-60")}
                  >
                    <TableCell className="font-mono text-sm">
                      {deadline.equipment?.inventory_number}
                    </TableCell>
                    <TableCell className="font-medium">
                      {deadline.equipment?.name}
                    </TableCell>
                    <TableCell>{deadline.deadline_type?.name}</TableCell>
                    <TableCell>{deadline.facility}</TableCell>
                    <TableCell>
                      {format(new Date(deadline.last_check_date), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(deadline.next_check_date), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell>{deadline.performer || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {deadline.deleted_at && (
                          <Badge variant="outline" className="bg-muted">Archivováno</Badge>
                        )}
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
                      </div>
                    </TableCell>
                    {archiveFilter !== "active" && (
                      <TableCell>
                        {deadline.deleted_at && (
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
