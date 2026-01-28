import { useState, useMemo } from "react";
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Search,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useDeadlineTypes } from "@/hooks/useDeadlineTypes";
import { useFacilities } from "@/hooks/useFacilities";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { DeadlineType } from "@/types/equipment";

export default function DeadlineTypes() {
  const { deadlineTypes, isLoading, error, refetch, createDeadlineType, updateDeadlineType, deleteDeadlineType, isCreating, isUpdating } = useDeadlineTypes();
  const { facilities } = useFacilities();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DeadlineType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    facility: "",
    period_days: 365,
    description: "",
  });

  const filteredTypes = useMemo(() => {
    if (!searchQuery) return deadlineTypes;
    const query = searchQuery.toLowerCase();
    return deadlineTypes.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.facility.toLowerCase().includes(query)
    );
  }, [deadlineTypes, searchQuery]);

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      facility: "",
      period_days: 365,
      description: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: DeadlineType) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      facility: item.facility,
      period_days: item.period_days,
      description: item.description || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      description: formData.description || null,
    };

    if (editingItem) {
      updateDeadlineType({ id: editingItem.id, ...data });
    } else {
      createDeadlineType(data);
    }
    setDialogOpen(false);
  };

  if (error) {
    return <ErrorDisplay title="Chyba při načítání typů událostí" message={error.message} onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return <TableSkeleton columns={5} rows={8} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Typy technických událostí</h1>
          <p className="text-muted-foreground">
            Celkem {filteredTypes.length} typů
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Nový typ
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Hledat typy událostí..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Provozovna</TableHead>
                <TableHead>Perioda</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    Nebyly nalezeny žádné typy událostí
                  </TableCell>
                </TableRow>
              ) : (
                filteredTypes.map(type => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>{type.facility}</TableCell>
                    <TableCell>{type.period_days} dní</TableCell>
                    <TableCell className="text-muted-foreground">
                      {type.description || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(type)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteDeadlineType(type.id)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Upravit typ události" : "Nový typ události"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Název *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Např. Revize elektro"
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
              <Label>Perioda (dní) *</Label>
              <Input
                type="number"
                value={formData.period_days}
                onChange={e => setFormData(prev => ({ ...prev, period_days: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Popis</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Volitelný popis typu události"
              />
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
