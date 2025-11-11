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
import { Edit, Trash2, Plus, Download, CalendarClock, FileSpreadsheet, FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { TrainingProtocolCell } from "@/components/TrainingProtocolCell";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPeriodicity } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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

    setDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    // TODO: Smazat vybraná školení z databáze
    console.log("Hromadné mazání:", Array.from(selectedTrainings));
    
    toast({
      title: "Školení smazána",
      description: `Smazáno ${selectedTrainings.size} školení.`,
    });

    setSelectedTrainings(new Set());
    setDeleteDialogOpen(false);
  };

  // Rychlý výběr školení expirujících do X dní
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

  // Získat detaily vybraných školení
  const selectedTrainingDetails = useMemo(() => {
    return filteredTrainings.filter(t => selectedTrainings.has(t.id));
  }, [selectedTrainings, filteredTrainings]);

  const exportToCSV = () => {
    try {
      // Exportovat vybraná školení, pokud jsou nějaká vybrána, jinak všechna filtrovaná
      const trainingsToExport = selectedTrainings.size > 0
        ? filteredTrainings.filter(t => selectedTrainings.has(t.id))
        : filteredTrainings;

      if (trainingsToExport.length === 0) {
        toast({
          title: "Žádná data k exportu",
          description: "Nejsou k dispozici žádná školení pro export.",
          variant: "destructive",
        });
        return;
      }

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
        "Periodicita",
        "Poznámka"
      ];

      // Mapování statusu na češtinu
      const statusMap = {
        valid: "Platné",
        warning: "Brzy vyprší",
        expired: "Prošlé"
      };

      // Převod dat na CSV řádky
      const rows = trainingsToExport.map(training => [
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
        formatPeriodicity(training.period),
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

      const exportMessage = selectedTrainings.size > 0
        ? `Exportováno ${trainingsToExport.length} vybraných školení.`
        : `Exportováno ${trainingsToExport.length} záznamů školení.`;

      toast({
        title: "Export úspěšný",
        description: exportMessage,
      });
    } catch (error) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  const exportToExcel = () => {
    try {
      const trainingsToExport = selectedTrainings.size > 0
        ? filteredTrainings.filter(t => selectedTrainings.has(t.id))
        : filteredTrainings;

      if (trainingsToExport.length === 0) {
        toast({
          title: "Žádná data k exportu",
          description: "Nejsou k dispozici žádná školení pro export.",
          variant: "destructive",
        });
        return;
      }

      const wb = XLSX.utils.book_new();

      // Mapování statusu
      const statusMap = {
        valid: "Platne",
        warning: "Brzy vyprsi",
        expired: "Prosle"
      };

      // Příprava dat
      const data = [
        ['Stav', 'Skoleni platne do', 'Typ skoleni', 'Osobni cislo', 'Jmeno', 'Provozovna', 'Stredisko', 'Datum skoleni', 'Skolitel', 'Firma', 'Zadavatel', 'Periodicita', 'Poznamka'],
        ...trainingsToExport.map(t => {
          return [
            statusMap[t.status],
            new Date(t.date).toLocaleDateString("cs-CZ"),
            t.type,
            t.employeeNumber,
            t.employeeName,
            t.facility,
            t.department,
            new Date(t.lastTrainingDate).toLocaleDateString("cs-CZ"),
            t.trainer || '',
            t.company || '',
            t.requester || '',
            formatPeriodicity(t.period),
            t.note || ''
          ];
        })
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Nastavit šířky sloupců
      ws['!cols'] = [
        { wch: 12 }, // Stav
        { wch: 15 }, // Skoleni platne do
        { wch: 25 }, // Typ skoleni
        { wch: 12 }, // Osobni cislo
        { wch: 20 }, // Jmeno
        { wch: 40 }, // Provozovna
        { wch: 15 }, // Stredisko
        { wch: 15 }, // Datum skoleni
        { wch: 20 }, // Skolitel
        { wch: 25 }, // Firma
        { wch: 20 }, // Zadavatel
        { wch: 12 }, // Perioda
        { wch: 30 }  // Poznamka
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Skoleni');

      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `skoleni_export_${timestamp}.xlsx`, {
        bookType: 'xlsx',
        type: 'binary'
      });

      const exportMessage = selectedTrainings.size > 0
        ? `Exportováno ${trainingsToExport.length} vybraných školení.`
        : `Exportováno ${trainingsToExport.length} záznamů školení.`;

      toast({
        title: "Export dokončen",
        description: exportMessage,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data do Excel.",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = () => {
    try {
      const trainingsToExport = selectedTrainings.size > 0
        ? filteredTrainings.filter(t => selectedTrainings.has(t.id))
        : filteredTrainings;

      if (trainingsToExport.length === 0) {
        toast({
          title: "Žádná data k exportu",
          description: "Nejsou k dispozici žádná školení pro export.",
          variant: "destructive",
        });
        return;
      }

      const pdf = new jsPDF('l', 'mm', 'a4'); // landscape
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;

      // Nadpis
      pdf.setFontSize(18);
      pdf.text('Seznam skoleni', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Datum generování
      pdf.setFontSize(10);
      const date = new Date().toLocaleDateString('cs-CZ');
      pdf.text(`Vygenerovano: ${date}`, pageWidth / 2, yPosition, { align: 'center' });
      
      if (selectedTrainings.size > 0) {
        pdf.text(`Exportovano: ${trainingsToExport.length} vybranych skoleni`, pageWidth / 2, yPosition + 5, { align: 'center' });
        yPosition += 10;
      }
      yPosition += 10;

      // Mapování statusu
      const statusMap = {
        valid: "Platne",
        warning: "Brzy vyprsi",
        expired: "Prosle"
      };

      // Tabulka se školením
      autoTable(pdf, {
        startY: yPosition,
        head: [['Stav', 'Platne do', 'Typ', 'Cislo', 'Jmeno', 'Stredisko', 'Skolitel', 'Firma']],
        body: trainingsToExport.map(t => [
          statusMap[t.status],
          new Date(t.date).toLocaleDateString("cs-CZ"),
          t.type,
          t.employeeNumber,
          t.employeeName,
          t.department,
          t.trainer || '-',
          t.company || '-'
        ]),
        theme: 'striped',
        headStyles: { 
          fillColor: [66, 66, 66],
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8
        },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 25 },
          2: { cellWidth: 45 },
          3: { cellWidth: 20 },
          4: { cellWidth: 40 },
          5: { cellWidth: 30 },
          6: { cellWidth: 35 },
          7: { cellWidth: 35 }
        },
        margin: { left: 10, right: 10 },
      });

      const timestamp = new Date().toISOString().split('T')[0];
      pdf.save(`skoleni_export_${timestamp}.pdf`);

      const exportMessage = selectedTrainings.size > 0
        ? `Exportováno ${trainingsToExport.length} vybraných školení.`
        : `Exportováno ${trainingsToExport.length} záznamů školení.`;

      toast({
        title: "Export dokončen",
        description: exportMessage,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data do PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Naplánovaná školení</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => selectExpiringTrainings(30)}
            title="Vybrat všechna školení, která vyprší do 30 dní"
          >
            <CalendarClock className="w-4 h-4 mr-2" />
            Vybrat expirující (30 dní)
          </Button>
          <Button variant="outline" onClick={exportToExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {selectedTrainings.size > 0 
              ? `Export Excel (${selectedTrainings.size})`
              : "Export Excel"
            }
          </Button>
          <Button variant="outline" onClick={exportToPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            {selectedTrainings.size > 0 
              ? `Export PDF (${selectedTrainings.size})`
              : "Export PDF"
            }
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
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Smazat vybrané
                </Button>
                <AlertDialogContent className="max-w-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Potvrzení smazání školení</AlertDialogTitle>
                    <AlertDialogDescription>
                      Opravdu chcete smazat následující školení? Tato akce je nevratná.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="space-y-3 py-4">
                      <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                        <div>Zaměstnanec</div>
                        <div>Typ školení</div>
                        <div>Datum</div>
                        <div>Stav</div>
                      </div>
                      {selectedTrainingDetails.map((training) => (
                        <div key={training.id} className="grid grid-cols-4 gap-2 text-sm border-b pb-2">
                          <div className="font-medium">
                            {training.employeeName}
                            <span className="text-xs text-muted-foreground block">
                              {training.employeeNumber}
                            </span>
                          </div>
                          <div>{training.type}</div>
                          <div className="text-xs">
                            {new Date(training.date).toLocaleDateString("cs-CZ")}
                          </div>
                          <div>
                            <StatusBadge status={training.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm font-medium text-destructive">
                        Celkem bude smazáno: {selectedTrainings.size} {selectedTrainings.size === 1 ? "školení" : "školení"}
                      </p>
                      <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                        <li>• Všechna data o školení budou trvale odstraněna</li>
                        <li>• Nahrané dokumenty zůstanou zachovány</li>
                        <li>• Historie školení bude aktualizována</li>
                      </ul>
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={confirmBulkDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Smazat {selectedTrainings.size} {selectedTrainings.size === 1 ? "školení" : "školení"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
                <TableHead>Periodicita</TableHead>
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
                  <TableCell className="text-center">
                    {(() => {
                      if (training.period % 365 === 0) {
                        const years = Math.round(training.period / 365);
                        const yearWord = years === 1 ? "rok" : years < 5 ? "roky" : "roků";
                        const prefix = years === 1 ? "každý" : years < 5 ? "každé" : "každých";
                        return `${prefix} ${years} ${yearWord}`;
                      } else if (training.period % 30 === 0) {
                        const months = Math.round(training.period / 30);
                        const monthWord = months === 1 ? "měsíc" : months < 5 ? "měsíce" : "měsíců";
                        const prefix = months === 1 ? "každý" : months < 5 ? "každé" : "každých";
                        return `${prefix} ${months} ${monthWord}`;
                      } else {
                        const days = training.period;
                        const dayWord = days === 1 ? "den" : days < 5 ? "dny" : "dní";
                        const prefix = days === 1 ? "každý" : days < 5 ? "každé" : "každých";
                        return `${prefix} ${days} ${dayWord}`;
                      }
                    })()}
                  </TableCell>
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
