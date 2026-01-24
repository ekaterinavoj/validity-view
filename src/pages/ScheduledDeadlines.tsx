import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  RefreshCw,
  Download,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Pencil,
  Archive,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useDeadlines } from "@/hooks/useDeadlines";
import { useFacilities } from "@/hooks/useFacilities";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

export default function ScheduledDeadlines() {
  const { deadlines, isLoading, error, refetch, archiveDeadline, isArchiving } = useDeadlines();
  const { facilities } = useFacilities();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Create filter options
  const facilityList = useMemo(() => 
    facilities.map(f => f.code),
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

  // Filter deadlines
  const filteredDeadlines = useMemo(() => {
    return deadlines.filter(d => {
      if (!d.is_active) return false;
      
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
      if (filters.dateFrom && new Date(d.next_check_date) < filters.dateFrom) return false;
      if (filters.dateTo && new Date(d.next_check_date) > filters.dateTo) return false;
      
      return true;
    });
  }, [deadlines, filters]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? filteredDeadlines.map(d => d.id) : []);
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => 
      checked ? [...prev, id] : prev.filter(i => i !== id)
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valid":
        return (
          <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Platná
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Brzy vyprší
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Prošlá
          </Badge>
        );
      default:
        return null;
    }
  };

  const exportToExcel = () => {
    const data = filteredDeadlines.map(d => ({
      "Inventární č.": d.equipment?.inventory_number || "",
      "Zařízení": d.equipment?.name || "",
      "Typ lhůty": d.deadline_type?.name || "",
      "Provozovna": d.facility,
      "Poslední kontrola": format(new Date(d.last_check_date), "dd.MM.yyyy"),
      "Příští kontrola": format(new Date(d.next_check_date), "dd.MM.yyyy"),
      "Stav": d.status === "valid" ? "Platná" : d.status === "warning" ? "Brzy vyprší" : "Prošlá",
      "Provádějící": d.performer || "",
      "Firma": d.company || "",
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Technické lhůty");
    XLSX.writeFile(wb, `technicke-lhuty-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  if (error) {
    return <ErrorDisplay title="Chyba při načítání technických lhůt" message={error.message} onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return <TableSkeleton columns={8} rows={10} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Naplánované technické lhůty</h1>
          <p className="text-muted-foreground">
            Celkem {filteredDeadlines.length} aktivních lhůt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Link to="/deadlines/new">
            <Button size="sm">
              <PlusCircle className="w-4 h-4 mr-2" />
              Nová lhůta
            </Button>
          </Link>
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
        resultCount={filteredDeadlines.length}
        totalCount={deadlines.length}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.length === filteredDeadlines.length && filteredDeadlines.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Inventární č.</TableHead>
                <TableHead>Zařízení</TableHead>
                <TableHead>Typ lhůty</TableHead>
                <TableHead>Provozovna</TableHead>
                <TableHead>Poslední</TableHead>
                <TableHead>Příští</TableHead>
                <TableHead>Provádějící</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeadlines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nebyly nalezeny žádné technické lhůty
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeadlines.map(deadline => (
                  <TableRow 
                    key={deadline.id}
                    className={cn(
                      deadline.status === "expired" && "bg-red-500/5",
                      deadline.status === "warning" && "bg-yellow-500/5"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(deadline.id)}
                        onCheckedChange={(checked) => handleSelectOne(deadline.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>{getStatusBadge(deadline.status)}</TableCell>
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
                    <TableCell className="font-medium">
                      {format(new Date(deadline.next_check_date), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell>{deadline.performer || "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/deadlines/edit/${deadline.id}`} className="flex items-center">
                              <Pencil className="w-4 h-4 mr-2" />
                              Upravit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => archiveDeadline(deadline.id)}
                            disabled={isArchiving}
                          >
                            <Archive className="w-4 h-4 mr-2" />
                            Archivovat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Platná lhůta</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Vyprší do 30 dnů</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Prošlá lhůta</span>
        </div>
      </div>
    </div>
  );
}
