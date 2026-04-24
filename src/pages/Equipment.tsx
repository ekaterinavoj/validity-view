import { useState, useMemo } from "react";
import { useSortable } from "@/hooks/useSortable";
import { SortableTableHead } from "@/components/SortableTableHead";
import { format } from "date-fns";
import Papa from "papaparse";
import {
  Plus,
  Download,
  Edit,
  Trash2,
  Search,
  Wrench,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEquipment, EquipmentDependencies } from "@/hooks/useEquipment";
import { useFacilities } from "@/hooks/useFacilities";
import { useDepartments } from "@/hooks/useDepartments";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { EquipmentResponsiblesManager } from "@/components/EquipmentResponsiblesManager";
import { EquipmentResponsiblesBadges } from "@/components/EquipmentResponsiblesBadges";
import { ResponsiblePersonsPicker } from "@/components/ResponsiblePersonsPicker";
import { BulkEquipmentImport } from "@/components/BulkEquipmentImport";
import { Equipment as EquipmentType, equipmentStatusLabels, equipmentStatusColors } from "@/types/equipment";
import { useAllEquipmentResponsibles } from "@/hooks/useEquipmentResponsibles";
import { cn } from "@/lib/utils";
// XLSX removed — exports use CSV
import { useToast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { RefreshButton } from "@/components/RefreshButton";

export default function Equipment() {
  const { toast } = useToast();
  const { equipment, isLoading, error, refetch, createEquipment, updateEquipment, deleteEquipment, checkDependencies, isCreating, isUpdating, isDeleting } = useEquipment();
  const { facilities } = useFacilities();
  const { allResponsibles } = useAllEquipmentResponsibles();

  // Mapování equipment_id → seznam e-mailů odpovědných osob (oddělené ; pro round-trip s importem).
  const responsibleEmailsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    allResponsibles.forEach((r: any) => {
      const email = r.profile?.email;
      if (!email) return;
      const arr = map.get(r.equipment_id) ?? [];
      if (!arr.includes(email)) arr.push(email);
      map.set(r.equipment_id, arr);
    });
    return map;
  }, [allResponsibles]);

  const facilityNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    facilities.forEach(f => { map[f.code] = f.name; });
    return map;
  }, [facilities]);

  const getFacilityName = (code: string): string => facilityNameMap[code] || code;
  const { departments } = useDepartments();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [equipmentToDelete, setEquipmentToDelete] = useState<EquipmentType | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<EquipmentDependencies | null>(null);
  const [checkingDeps, setCheckingDeps] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentType | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ message: string; pendingData: typeof formData } | null>(null);
  const [selectedResponsibleIds, setSelectedResponsibleIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    inventory_number: "",
    name: "",
    equipment_type: "",
    facility: "",
    department_id: "",
    manufacturer: "",
    model: "",
    serial_number: "",
    location: "",
    responsible_person: "",
    status: "active" as "active" | "inactive" | "decommissioned",
    notes: "",
  });

  const uniqueTypes = useMemo(() => {
    const types = new Set(equipment.map(eq => eq.equipment_type).filter(Boolean));
    return Array.from(types).sort();
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      if (statusFilter !== "all" && eq.status !== statusFilter) return false;
      if (facilityFilter !== "all" && eq.facility !== facilityFilter) return false;
      if (departmentFilter !== "all" && eq.department_id !== departmentFilter) return false;
      if (typeFilter !== "all" && eq.equipment_type !== typeFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          eq.name.toLowerCase().includes(query) ||
          eq.inventory_number.toLowerCase().includes(query) ||
          eq.equipment_type.toLowerCase().includes(query) ||
          (eq.manufacturer || "").toLowerCase().includes(query) ||
          (eq.serial_number || "").toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [equipment, searchQuery, statusFilter, facilityFilter, departmentFilter, typeFilter]);

  const { sortedData: sortedEquipment, sortConfig, requestSort } = useSortable(filteredEquipment);
  const { preferences } = useUserPreferences();
  const { currentPage, setCurrentPage, totalPages, paginatedItems: paginatedEquipment, totalItems } = usePagination(sortedEquipment, preferences.itemsPerPage);

  const openCreateDialog = () => {
    setEditingItem(null);
    setSelectedResponsibleIds([]);
    setFormData({
      inventory_number: "",
      name: "",
      equipment_type: "",
      facility: "",
      department_id: "",
      manufacturer: "",
      model: "",
      serial_number: "",
      location: "",
      responsible_person: "",
      status: "active",
      notes: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: EquipmentType) => {
    setEditingItem(item);
    setSelectedResponsibleIds([]); // Will be managed by EquipmentResponsiblesManager
    setFormData({
      inventory_number: item.inventory_number,
      name: item.name,
      equipment_type: item.equipment_type,
      facility: item.facility,
      department_id: item.department_id || "",
      manufacturer: item.manufacturer || "",
      model: item.model || "",
      serial_number: item.serial_number || "",
      location: item.location || "",
      responsible_person: item.responsible_person || "",
      status: item.status,
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = async (item: EquipmentType) => {
    setEquipmentToDelete(item);
    setCheckingDeps(true);
    setDeleteDialogOpen(true);
    
    try {
      const deps = await checkDependencies(item.id);
      setDeleteDependencies(deps);
    } catch (err) {
      console.error("Error checking dependencies:", err);
      setDeleteDependencies({ deadlinesCount: 0 });
    } finally {
      setCheckingDeps(false);
    }
  };

  const handleDelete = () => {
    if (!equipmentToDelete) return;
    deleteEquipment(equipmentToDelete.id);
    setDeleteDialogOpen(false);
    setEquipmentToDelete(null);
    setDeleteDependencies(null);
  };

  const performCreate = (data: typeof formData) => {
    const equipmentData = {
      ...data,
      department_id: data.department_id || null,
      description: null as string | null,
      purchase_date: null as string | null,
    };
    createEquipment({
      equipment: equipmentData,
      responsibleProfileIds: selectedResponsibleIds,
    });
  };

  const handleSubmit = () => {
    const equipmentData = {
      ...formData,
      department_id: formData.department_id || null,
      description: null as string | null,
      purchase_date: null as string | null,
    };

    if (editingItem) {
      updateEquipment({ id: editingItem.id, ...equipmentData });
      setDialogOpen(false);
      return;
    }

    // Soft duplicate check on create — warn but allow override
    const invNorm = formData.inventory_number.trim().toLowerCase();
    const nameNorm = formData.name.trim().toLowerCase();
    const serialNorm = formData.serial_number.trim().toLowerCase();

    const matches: string[] = [];
    const sameInv = invNorm && equipment.find(e => (e.inventory_number || "").trim().toLowerCase() === invNorm);
    const sameName = nameNorm && equipment.find(e => (e.name || "").trim().toLowerCase() === nameNorm);
    const sameSerial = serialNorm && equipment.find(e => (e.serial_number || "").trim().toLowerCase() === serialNorm);

    if (sameInv) matches.push(`inventární číslo „${formData.inventory_number}" (${sameInv.name})`);
    if (sameName) matches.push(`název „${formData.name}" (inv. č. ${sameName.inventory_number})`);
    if (sameSerial) matches.push(`sériové číslo „${formData.serial_number}" (${sameSerial.name})`);

    if (matches.length > 0) {
      setDuplicateWarning({
        message: `V evidenci již existuje zařízení se shodným ${matches.join(" a ")}. Opravdu chcete vytvořit další?`,
        pendingData: formData,
      });
      return;
    }

    performCreate(formData);
    setDialogOpen(false);
  };

  const exportToCSV = () => {
    const data = equipment.map(eq => ({
      "Inv. číslo": eq.inventory_number || "",
      "Název": eq.name || "",
      "Typ": eq.equipment_type || "",
      "Provozovna": getFacilityName(eq.facility) || "",
      "Výrobce": eq.manufacturer || "",
      "Model": eq.model || "",
      "Sériové č.": eq.serial_number || "",
      "Umístění": eq.location || "",
      "Odpovědná osoba": eq.responsible_person || "",
      "Odpovědné osoby": (responsibleEmailsMap.get(eq.id) ?? []).join("; "),
      "Stav": equipmentStatusLabels[eq.status] || "",
    }));

    const csv = Papa.unparse(data, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `zarizeni-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return <ErrorDisplay title="Chyba při načítání zařízení" message={error.message} onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return <TableSkeleton columns={8} rows={10} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Zařízení</h1>
          <p className="text-muted-foreground">
            Celkem {filteredEquipment.length} zařízení
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={() => refetch()} loading={isLoading} />
          <BulkEquipmentImport onImportComplete={() => refetch()} />
          <Button variant="outline" size="sm" onClick={exportToCSV} title="Formát: CSV (středník, UTF-8)">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Nové zařízení
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hledat zařízení..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny stavy</SelectItem>
            <SelectItem value="active">Aktivní</SelectItem>
            <SelectItem value="inactive">Neaktivní</SelectItem>
            <SelectItem value="decommissioned">Vyřazené</SelectItem>
          </SelectContent>
        </Select>
        <Select value={facilityFilter} onValueChange={setFacilityFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Provozovna" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny provozovny</SelectItem>
            {facilities.map(f => (
              <SelectItem key={f.id} value={f.code}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Středisko" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechna střediska</SelectItem>
            {departments.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Typ zařízení" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny typy</SelectItem>
            {uniqueTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Inv. číslo" sortKey="inventory_number" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Název" sortKey="name" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Typ" sortKey="equipment_type" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Výrobce" sortKey="manufacturer" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Model" sortKey="model" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Sériové č." sortKey="serial_number" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Provozovna" sortKey="facility" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <SortableTableHead label="Umístění" sortKey="location" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <TableHead>Odpovědná osoba</TableHead>
                <SortableTableHead label="Stav" sortKey="status" currentSortKey={sortConfig.key} currentDirection={sortConfig.direction} onSort={requestSort} />
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEquipment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    <Wrench className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    Nebylo nalezeno žádné zařízení
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEquipment.map(eq => (
                  <TableRow key={eq.id}>
                    <TableCell className="font-mono text-sm">{eq.inventory_number}</TableCell>
                    <TableCell className="font-medium">{eq.name}</TableCell>
                    <TableCell>{eq.equipment_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{eq.manufacturer || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{eq.model || "-"}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{eq.serial_number || "-"}</TableCell>
                    <TableCell>{getFacilityName(eq.facility)}</TableCell>
                    <TableCell>{eq.location || "-"}</TableCell>
                    <TableCell>
                      <EquipmentResponsiblesBadges equipmentId={eq.id} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(equipmentStatusColors[eq.status])}>
                        {equipmentStatusLabels[eq.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(eq)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(eq)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={preferences.itemsPerPage} onPageChange={setCurrentPage} />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Upravit zařízení" : "Nové zařízení"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Inventární číslo *</Label>
              <Input
                value={formData.inventory_number}
                onChange={e => setFormData(prev => ({ ...prev, inventory_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Název *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Typ zařízení *</Label>
              <Input
                value={formData.equipment_type}
                onChange={e => setFormData(prev => ({ ...prev, equipment_type: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Provozovna *</Label>
              <Select
                value={formData.facility}
                onValueChange={val => setFormData(prev => ({ ...prev, facility: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte provozovnu" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map(f => (
                    <SelectItem key={f.id} value={f.code}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Výrobce</Label>
              <Input
                value={formData.manufacturer}
                onChange={e => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={formData.model}
                onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Sériové číslo</Label>
              <Input
                value={formData.serial_number}
                onChange={e => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Umístění</Label>
              <Input
                value={formData.location}
                onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Oddělení</Label>
              <Select
                value={formData.department_id}
                onValueChange={val => setFormData(prev => ({ ...prev, department_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte oddělení" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stav</Label>
              <Select
                value={formData.status}
                onValueChange={val => setFormData(prev => ({ ...prev, status: val as "active" | "inactive" | "decommissioned" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktivní</SelectItem>
                  <SelectItem value="inactive">Neaktivní</SelectItem>
                  <SelectItem value="decommissioned">Vyřazeno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Poznámky</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            
            {/* Responsible persons management */}
            <Separator className="col-span-2 my-2" />
            <div className="col-span-2">
              {editingItem ? (
                <EquipmentResponsiblesManager
                  equipmentId={editingItem.id}
                  equipmentName={editingItem.name}
                />
              ) : (
                <ResponsiblePersonsPicker
                  selectedIds={selectedResponsibleIds}
                  onSelectionChange={setSelectedResponsibleIds}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Zrušit
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating || isUpdating}>
              {editingItem ? "Uložit změny" : "Vytvořit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteDependencies && deleteDependencies.deadlinesCount > 0 ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Nelze smazat zařízení
                </>
              ) : (
                "Opravdu chcete smazat zařízení?"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {checkingDeps ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Kontrola závislostí...
                </div>
              ) : deleteDependencies && deleteDependencies.deadlinesCount > 0 ? (
                <div className="space-y-2">
                  <p>
                    Zařízení <strong>{equipmentToDelete?.name}</strong> nelze smazat, protože má přiřazené záznamy:
                  </p>
                  <ul className="list-disc list-inside text-sm">
                    <li>{deleteDependencies.deadlinesCount} technických událostí</li>
                  </ul>
                  <p className="text-sm">
                    Nejprve smažte nebo archivujte tyto události v modulu Technické události.
                  </p>
                </div>
              ) : (
                <p>
                  Zařízení <strong>{equipmentToDelete?.name}</strong> ({equipmentToDelete?.inventory_number}) bude trvale odstraněno.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            {(!deleteDependencies || deleteDependencies.deadlinesCount === 0) && !checkingDeps && (
              <AlertDialogAction 
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Smazat
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!duplicateWarning} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Možná duplicita
            </AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateWarning?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (duplicateWarning) {
                  performCreate(duplicateWarning.pendingData);
                  setDuplicateWarning(null);
                  setDialogOpen(false);
                }
              }}
            >
              Přesto vytvořit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
