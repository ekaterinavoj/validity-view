import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Training } from "@/types/training";
import { Download } from "lucide-react";
import { useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { StatusBadge } from "@/components/StatusBadge";

// Mock historical data
const mockHistory: Training[] = [
  {
    id: "1",
    status: "valid",
    date: "2024-12-15",
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
    note: "Provedeno",
  },
  {
    id: "2",
    status: "valid",
    date: "2024-11-20",
    type: "Práce ve výškách",
    employeeNumber: "12346",
    employeeName: "Petr Dvořák",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
    department: "Údržba",
    lastTrainingDate: "2024-11-20",
    trainer: "Tomáš Černý",
    company: "Výškové práce s.r.o.",
    requester: "Marie Procházková",
    period: 730,
    reminderTemplate: "Urgentní",
    calendar: "Ano",
    note: "Dokončeno",
  },
];

export default function History() {
  const { toast } = useToast();
  const {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    saveCurrentFilters,
    loadSavedFilter,
    deleteSavedFilter,
    savedFilters,
  } = useAdvancedFilters("history-filters");

  const departments = useMemo(() => {
    const depts = new Set(mockHistory.map((t) => t.department));
    return Array.from(depts).sort();
  }, []);

  const trainingTypes = useMemo(() => {
    const types = new Set(mockHistory.map((t) => t.type));
    return Array.from(types).sort();
  }, []);

  const trainers = useMemo(() => {
    const trainerSet = new Set(mockHistory.map((t) => t.trainer));
    return Array.from(trainerSet).sort();
  }, []);

  const filteredHistory = useMemo(() => {
    return mockHistory.filter((training) => {
      const searchLower = filters.searchQuery.toLowerCase();
      const matchesSearch =
        filters.searchQuery === "" ||
        training.employeeName.toLowerCase().includes(searchLower) ||
        training.employeeNumber.includes(searchLower) ||
        training.type.toLowerCase().includes(searchLower) ||
        training.department.toLowerCase().includes(searchLower) ||
        training.trainer.toLowerCase().includes(searchLower);

      const matchesStatus =
        filters.statusFilter === "all" || training.status === filters.statusFilter;
      const matchesDepartment =
        filters.departmentFilter === "all" ||
        training.department === filters.departmentFilter;
      const matchesType =
        filters.typeFilter === "all" || training.type === filters.typeFilter;
      const matchesTrainer =
        filters.trainerFilter === "all" || training.trainer === filters.trainerFilter;

      const trainingDate = new Date(training.date);
      const matchesDateFrom = !filters.dateFrom || trainingDate >= filters.dateFrom;
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

  const exportToCSV = () => {
    try {
      const headers = [
        "Datum",
        "Typ školení",
        "Osobní číslo",
        "Jméno",
        "Středisko",
        "Školitel",
        "Firma",
        "Poznámka",
      ];

      const rows = filteredHistory.map((training) => [
        new Date(training.date).toLocaleDateString("cs-CZ"),
        training.type,
        training.employeeNumber,
        training.employeeName,
        training.department,
        training.trainer,
        training.company,
        training.note,
      ]);

      const escapeCSV = (value: string) => {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csvContent = [
        headers.map(escapeCSV).join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split("T")[0];
      link.setAttribute("href", url);
      link.setAttribute("download", `historie_export_${timestamp}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${filteredHistory.length} záznamů.`,
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
        <h2 className="text-3xl font-bold text-foreground">Historie školení</h2>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
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
        departments={departments}
        trainingTypes={trainingTypes}
        trainers={trainers}
        resultCount={filteredHistory.length}
        totalCount={mockHistory.length}
      />

      <Card className="p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ školení</TableHead>
                <TableHead>Osobní číslo</TableHead>
                <TableHead>Jméno</TableHead>
                <TableHead>Středisko</TableHead>
                <TableHead>Školitel</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Poznámka</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Žádná historie nenalezena
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((training) => (
                  <TableRow key={training.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(training.date).toLocaleDateString("cs-CZ")}
                    </TableCell>
                    <TableCell className="font-medium">{training.type}</TableCell>
                    <TableCell>{training.employeeNumber}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {training.employeeName}
                    </TableCell>
                    <TableCell>{training.department}</TableCell>
                    <TableCell className="whitespace-nowrap">{training.trainer}</TableCell>
                    <TableCell className="whitespace-nowrap">{training.company}</TableCell>
                    <TableCell>{training.note}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
