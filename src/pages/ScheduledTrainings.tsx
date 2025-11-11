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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Training } from "@/types/training";
import { Edit, Trash2, Plus, Search, X, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

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
  },
];

export default function ScheduledTrainings() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Získat unikátní oddělení a typy školení
  const departments = useMemo(() => {
    const depts = new Set(mockTrainings.map(t => t.department));
    return Array.from(depts).sort();
  }, []);

  const trainingTypes = useMemo(() => {
    const types = new Set(mockTrainings.map(t => t.type));
    return Array.from(types).sort();
  }, []);

  // Filtrovaná data
  const filteredTrainings = useMemo(() => {
    return mockTrainings.filter(training => {
      // Vyhledávání
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchQuery === "" || 
        training.employeeName.toLowerCase().includes(searchLower) ||
        training.employeeNumber.includes(searchLower) ||
        training.type.toLowerCase().includes(searchLower) ||
        training.department.toLowerCase().includes(searchLower) ||
        training.trainer.toLowerCase().includes(searchLower);

      // Filtry
      const matchesStatus = statusFilter === "all" || training.status === statusFilter;
      const matchesDepartment = departmentFilter === "all" || training.department === departmentFilter;
      const matchesType = typeFilter === "all" || training.type === typeFilter;

      return matchesSearch && matchesStatus && matchesDepartment && matchesType;
    });
  }, [searchQuery, statusFilter, departmentFilter, typeFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDepartmentFilter("all");
    setTypeFilter("all");
  };

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "all" || 
    departmentFilter !== "all" || typeFilter !== "all";

  const exportToCSV = () => {
    try {
      // Hlavičky CSV
      const headers = [
        "Stav",
        "Datum školení",
        "Typ školení",
        "Osobní číslo",
        "Jméno",
        "Provozovna",
        "Středisko",
        "Datum posledního školení",
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
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nové školení
          </Button>
        </div>
      </div>

      {/* Vyhledávání a filtry */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {/* Vyhledávání */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hledat podle jména, osobního čísla, typu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Filtr stavu */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Stav školení" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny stavy</SelectItem>
              <SelectItem value="valid">Platné</SelectItem>
              <SelectItem value="warning">Brzy vyprší</SelectItem>
              <SelectItem value="expired">Prošlé</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtr oddělení */}
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Oddělení" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechna oddělení</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtr typu školení */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Typ školení" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny typy</SelectItem>
              {trainingTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vymazat filtry */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Zobrazeno {filteredTrainings.length} z {mockTrainings.length} školení
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-2" />
              Vymazat filtry
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stav</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Typ školení</TableHead>
                <TableHead>Osobní číslo</TableHead>
                <TableHead>Jméno</TableHead>
                <TableHead>Provozovna</TableHead>
                <TableHead>Středisko</TableHead>
                <TableHead>Poslední školení</TableHead>
                <TableHead>Školitel</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Zadavatel</TableHead>
                <TableHead>Perioda (dny)</TableHead>
                <TableHead>Poznámka</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrainings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                    Žádná školení nenalezena
                  </TableCell>
                </TableRow>
              ) : (
                filteredTrainings.map((training) => (
                <TableRow key={training.id}>
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
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon">
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
