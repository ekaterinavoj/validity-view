import { StatusBadge } from "@/components/StatusBadge";
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
import { Training } from "@/types/training";
import { Edit, Trash2, Plus, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { TrainingProtocolCell } from "@/components/TrainingProtocolCell";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Mock data
const mockTrainings: Training[] = [
  {
    id: "1",
    status: "valid",
    date: "2025-12-15",
    type: "BOZP - Základní",
    employeeNumber: "12345",
    employeeName: "Jan Novák",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
    department: "Výroba",
    lastTrainingDate: "2024-12-15",
    trainer: "Petr Svoboda",
    company: "BOZP Servis s.r.o.",
    requester: "Marie Procházková",
    period: 365,
    reminderTemplate: "Standardní",
    calendar: "Ano",
    note: "Pravidelné školení",
    is_active: true,
  },
  {
    id: "2",
    status: "warning",
    date: "2025-01-20",
    type: "Práce ve výškách",
    employeeNumber: "12346",
    employeeName: "Petr Dvořák",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
    department: "Údržba",
    lastTrainingDate: "2023-01-20",
    trainer: "Tomáš Černý",
    company: "Výškové práce s.r.o.",
    requester: "Marie Procházková",
    period: 730,
    reminderTemplate: "Urgentní",
    calendar: "Ano",
    note: "Prodloužená perioda",
    is_active: true,
  },
  {
    id: "3",
    status: "expired",
    date: "2024-11-01",
    type: "Řidičský průkaz VZV",
    employeeNumber: "12347",
    employeeName: "Jana Svobodová",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
    department: "Logistika",
    lastTrainingDate: "2019-11-01",
    trainer: "Jiří Malý",
    company: "VZV Školení s.r.o.",
    requester: "Marie Procházková",
    period: 1825,
    reminderTemplate: "Standardní",
    calendar: "Ne",
    note: "Nutné obnovit",
    is_active: true,
  },
];

export default function ScheduledTrainings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedTrainings, setSelectedTrainings] = useState<Set<string>>(new Set());
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    trainer: "",
    company: "",
    note: "",
  });
  
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

  // Získat unikátní hodnoty pro filtry
  const departments = useMemo(() => {
    const depts = new Set(mockTrainings.map((t) => t.department));
    return Array.from(depts).sort();
  }, []);

  const trainingTypes = useMemo(() => {
    const types = new Set(mockTrainings.map((t) => t.type));
    return Array.from(types).sort();
  }, []);

  const trainers = useMemo(() => {
    const trainerSet = new Set(mockTrainings.map((t) => t.trainer));
    return Array.from(trainerSet).sort();
  }, []);

  // Filtrovaná data - pouze aktivní školení
  const filteredTrainings = useMemo(() => {
    return mockTrainings.filter((training) => {
      // Zobrazit pouze aktivní školení (kde zaměstnanec má status "zaměstnáno")
      if (training.is_active === false) {
        return false;
      }
      // Vyhledávání
      const searchLower = filters.searchQuery.toLowerCase();
      const matchesSearch =
        filters.searchQuery === "" ||
        training.employeeName.toLowerCase().includes(searchLower) ||
        training.employeeNumber.includes(searchLower) ||
        training.type.toLowerCase().includes(searchLower) ||
        training.department.toLowerCase().includes(searchLower) ||
        training.trainer.toLowerCase().includes(searchLower);

      // Filtry
      const matchesStatus =
        filters.statusFilter === "all" || training.status === filters.statusFilter;
      const matchesDepartment =
        filters.departmentFilter === "all" ||
        training.department === filters.departmentFilter;
      const matchesType =
        filters.typeFilter === "all" || training.type === filters.typeFilter;
      const matchesTrainer =
        filters.trainerFilter === "all" || training.trainer === filters.trainerFilter;

      // Datum filtrování
      const trainingDate = new Date(training.date);
      const matchesDateFrom =
        !filters.dateFrom || trainingDate >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || trainingDate <= filters.dateTo;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDepartment &&
        matchesType &&
        matchesTrainer &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [filters]);

  // Hromadný výběr
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

  const applyBulkEdit = () => {
    // TODO: Aplikovat změny na vybraná školení v databázi
    console.log("Hromadná úprava:", {
      selectedIds: Array.from(selectedTrainings),
      changes: bulkEditData,
    });

    toast({
      title: "Hromadná úprava provedena",
      description: `Aktualizováno ${selectedTrainings.size} školení.`,
    });

    // Reset
    setBulkEditDialogOpen(false);
    setSelectedTrainings(new Set());
    setBulkEditData({ trainer: "", company: "", note: "" });
  };

  const handleBulkDelete = () => {
    if (selectedTrainings.size === 0) {
      toast({
        title: "Žádná školení vybrána",
        description: "Vyberte alespoň jedno školení pro smazání.",
        variant: "destructive",
      });
      return;
    }

    // TODO: Přidat potvrzovací dialog a mazání z databáze
    console.log("Hromadné mazání:", Array.from(selectedTrainings));
    
    toast({
      title: "Školení smazána",
      description: `Smazáno ${selectedTrainings.size} školení.`,
    });

    setSelectedTrainings(new Set());
  };

  const exportToCSV = () => {
    try {
      // Hlavičky CSV
      const headers = [
        "Stav",
        "Školení platné do",
        "Typ školení",
        "Osobní číslo",
        "Jméno",
        "Provozovna",
        "Středisko",
        "Datum školení",
        "Školitel",
        "Firma",
        "Zadavatel",
        "Perioda (dny)",
        "Poznámka"
      ];

      // Mapování statusu na češtinu
      const statusMap = {
        valid: "Platné",
        warning: "Brzy vyprší",
        expired: "Prošlé"
      };

      // Převod dat na CSV řádky
      const rows = filteredTrainings.map(training => [
        statusMap[training.status],
        new Date(training.date).toLocaleDateString("cs-CZ"),
        training.type,
        training.employeeNumber,
        training.employeeName,
        training.facility,
        training.department,
        new Date(training.lastTrainingDate).toLocaleDateString("cs-CZ"),
        training.trainer,
        training.company,
        training.requester,
        training.period.toString(),
        training.note
      ]);

      // Escapování hodnot pro CSV (uvozovky kolem hodnot s čárkami)
      const escapeCSV = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      // Vytvoření CSV obsahu
      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
      ].join('\n');

      // Přidání BOM pro správné zobrazení českých znaků v Excelu
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Stažení souboru
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
        description: `Exportováno ${filteredTrainings.length} záznamů školení.`,
      });
    } catch (error) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Naplánovaná školení</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => navigate("/new-training")}>
            <Plus className="w-4 h-4 mr-2" />
            Nové školení
          </Button>
        </div>
      </div>

      {/* Hromadné akce */}
      {selectedTrainings.size > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium">
                Vybráno {selectedTrainings.size} {selectedTrainings.size === 1 ? "školení" : "školení"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTrainings(new Set())}
              >
                Zrušit výběr
              </Button>
            </div>
            <div className="flex gap-2">
              <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm" onClick={handleBulkEdit}>
                    <Edit className="w-4 h-4 mr-2" />
                    Hromadná úprava
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Hromadná úprava školení</DialogTitle>
                    <DialogDescription>
                      Změny budou aplikovány na {selectedTrainings.size} {selectedTrainings.size === 1 ? "školení" : "školení"}.
                      Prázdná pole zůstanou beze změny.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Školitel</Label>
                      <Input
                        placeholder="Nový školitel (ponechat prázdné pro beze změny)"
                        value={bulkEditData.trainer}
                        onChange={(e) =>
                          setBulkEditData({ ...bulkEditData, trainer: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Firma</Label>
                      <Input
                        placeholder="Nová firma (ponechat prázdné pro beze změny)"
                        value={bulkEditData.company}
                        onChange={(e) =>
                          setBulkEditData({ ...bulkEditData, company: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Poznámka</Label>
                      <Textarea
                        placeholder="Nová poznámka (ponechat prázdné pro beze změny)"
                        value={bulkEditData.note}
                        onChange={(e) =>
                          setBulkEditData({ ...bulkEditData, note: e.target.value })
                        }
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setBulkEditDialogOpen(false)}
                    >
                      Zrušit
                    </Button>
                    <Button onClick={applyBulkEdit}>Aplikovat změny</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Smazat vybrané
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Pokročilé filtry */}
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
        trainingTypes={trainingTypes}
        trainers={trainers}
        resultCount={filteredTrainings.length}
        totalCount={mockTrainings.length}
      />

      <Card className="p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      filteredTrainings.length > 0 &&
                      selectedTrainings.size === filteredTrainings.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Školení platné do</TableHead>
                <TableHead>Typ školení</TableHead>
                <TableHead>Osobní číslo</TableHead>
                <TableHead>Jméno</TableHead>
                <TableHead>Provozovna</TableHead>
                <TableHead>Středisko</TableHead>
                <TableHead>Datum školení</TableHead>
                <TableHead>Školitel</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Zadavatel</TableHead>
                <TableHead>Perioda (dny)</TableHead>
                <TableHead>Poznámka</TableHead>
                <TableHead className="text-center">Aktuální protokol</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrainings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={16} className="text-center py-8 text-muted-foreground">
                    Žádná školení nenalezena
                  </TableCell>
                </TableRow>
              ) : (
                filteredTrainings.map((training) => (
                <TableRow key={training.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedTrainings.has(training.id)}
                      onCheckedChange={() => toggleSelectTraining(training.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={training.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(training.date).toLocaleDateString("cs-CZ")}
                  </TableCell>
                  <TableCell className="font-medium">{training.type}</TableCell>
                  <TableCell>{training.employeeNumber}</TableCell>
                  <TableCell className="whitespace-nowrap">{training.employeeName}</TableCell>
                  <TableCell className="max-w-xs truncate" title={training.facility}>
                    {training.facility}
                  </TableCell>
                  <TableCell>{training.department}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(training.lastTrainingDate).toLocaleDateString("cs-CZ")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{training.trainer}</TableCell>
                  <TableCell className="whitespace-nowrap">{training.company}</TableCell>
                  <TableCell className="whitespace-nowrap">{training.requester}</TableCell>
                  <TableCell className="text-center">{training.period}</TableCell>
                  <TableCell className="max-w-xs truncate" title={training.note}>
                    {training.note}
                  </TableCell>
                  <TableCell>
                    <TrainingProtocolCell trainingId={training.id} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => navigate(`/edit-training/${training.id}`)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-status-valid" />
          <span>Platné školení (v termínu)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-status-warning" />
          <span>Brzy vyprší (méně než měsíc)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-status-expired" />
          <span>Prošlé (po datu platnosti)</span>
        </div>
      </div>
    </div>
  );
}
