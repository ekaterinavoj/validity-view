import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Plus,
  RefreshCw,
  Download,
  Edit,
  Trash2,
  Search,
  Wrench,
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
import { useEquipment } from "@/hooks/useEquipment";
import { useFacilities } from "@/hooks/useFacilities";
import { useDepartments } from "@/hooks/useDepartments";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { EquipmentResponsiblesManager } from "@/components/EquipmentResponsiblesManager";
import { ResponsiblePersonsPicker } from "@/components/ResponsiblePersonsPicker";
import { Equipment as EquipmentType, equipmentStatusLabels, equipmentStatusColors } from "@/types/equipment";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

export default function Equipment() {
  const { equipment, isLoading, error, refetch, createEquipment, updateEquipment, deleteEquipment, isCreating, isUpdating } = useEquipment();
  const { facilities } = useFacilities();
  const { departments } = useDepartments();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentType | null>(null);
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

  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      if (statusFilter !== "all" && eq.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          eq.name.toLowerCase().includes(query) ||
          eq.inventory_number.toLowerCase().includes(query) ||
          eq.equipment_type.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [equipment, searchQuery, statusFilter]);

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

  const handleSubmit = () => {
    const equipmentData = {
      ...formData,
      department_id: formData.department_id || null,
    };

    if (editingItem) {
      updateEquipment({ id: editingItem.id, ...equipmentData });
    } else {
      createEquipment({
        equipment: equipmentData,
        responsibleProfileIds: selectedResponsibleIds,
      });
    }
    setDialogOpen(false);
  };

  const exportToCSV = () => {
    const headers = ["Inv. číslo", "Název", "Typ", "Provozovna", "Výrobce", "Model", "Sériové č.", "Umístění", "Odpovědná osoba", "Stav"];
    const rows = filteredEquipment.map(eq => [
      eq.inventory_number,
      eq.name,
      eq.equipment_type,
      eq.facility,
      eq.manufacturer || "",
      eq.model || "",
      eq.serial_number || "",
      eq.location || "",
      eq.responsible_person || "",
      equipmentStatusLabels[eq.status],
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
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Nové zařízení
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
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
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inv. číslo</TableHead>
                <TableHead>Název</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Provozovna</TableHead>
                <TableHead>Umístění</TableHead>
                <TableHead>Odpovědná osoba</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEquipment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Wrench className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    Nebylo nalezeno žádné zařízení
                  </TableCell>
                </TableRow>
              ) : (
                filteredEquipment.map(eq => (
                  <TableRow key={eq.id}>
                    <TableCell className="font-mono text-sm">{eq.inventory_number}</TableCell>
                    <TableCell className="font-medium">{eq.name}</TableCell>
                    <TableCell>{eq.equipment_type}</TableCell>
                    <TableCell>{eq.facility}</TableCell>
                    <TableCell>{eq.location || "-"}</TableCell>
                    <TableCell>{eq.responsible_person || "-"}</TableCell>
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
                          onClick={() => deleteEquipment(eq.id)}
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
              <Label>Odpovědná osoba</Label>
              <Input
                value={formData.responsible_person}
                onChange={e => setFormData(prev => ({ ...prev, responsible_person: e.target.value }))}
              />
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
    </div>
  );
}
