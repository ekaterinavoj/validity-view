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
import { Download, Loader2, RefreshCw, FileSpreadsheet, FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTrainingHistory } from "@/hooks/useTrainingHistory";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const employeeStatusLabels: Record<string, string> = {
  employed: "Aktivní",
  parental_leave: "Mateřská/rodičovská",
  sick_leave: "Nemocenská",
  terminated: "Ukončený",
};

const employeeStatusColors: Record<string, string> = {
  employed: "bg-green-500",
  parental_leave: "bg-blue-500",
  sick_leave: "bg-yellow-500",
  terminated: "bg-red-500",
};

export default function History() {
  const { toast } = useToast();
  const { trainings, loading, error, refetch } = useTrainingHistory();
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<string>("all");

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
    const depts = new Set(trainings.map((t) => t.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [trainings]);

  const trainingTypes = useMemo(() => {
    const types = new Set(trainings.map((t) => t.type).filter(Boolean));
    return Array.from(types).sort();
  }, [trainings]);

  const trainers = useMemo(() => {
    const trainerSet = new Set(trainings.map((t) => t.trainer).filter(Boolean));
    return Array.from(trainerSet).sort();
  }, [trainings]);

  const filteredHistory = useMemo(() => {
    return trainings.filter((training) => {
      // Employee status filter
      const matchesEmployeeStatus =
        employeeStatusFilter === "all" || training.employeeStatus === employeeStatusFilter;

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
        matchesEmployeeStatus &&
        matchesSearch &&
        matchesStatus &&
        matchesDepartment &&
        matchesType &&
        matchesTrainer &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [filters, trainings, employeeStatusFilter]);

  const exportToExcel = () => {
    try {
      const dataToExport = filteredHistory.map((training) => ({
        "Datum": new Date(training.date).toLocaleDateString("cs-CZ"),
        "Typ školení": training.type,
        "Osobní číslo": training.employeeNumber,
        "Jméno": training.employeeName,
        "Stav zaměstnance": employeeStatusLabels[training.employeeStatus] || training.employeeStatus,
        "Středisko": training.department,
        "Školitel": training.trainer,
        "Firma": training.company,
        "Poznámka": training.note || "",
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historie");
      
      const timestamp = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `historie_skoleni_${timestamp}.xlsx`);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${filteredHistory.length} záznamů do Excel.`,
      });
    } catch (err) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      
      doc.setFontSize(16);
      doc.text("Historie školení", 14, 15);
      doc.setFontSize(10);
      doc.text(`Vygenerováno: ${new Date().toLocaleDateString("cs-CZ")}`, 14, 22);

      const tableData = filteredHistory.map((training) => [
        new Date(training.date).toLocaleDateString("cs-CZ"),
        training.type,
        training.employeeNumber,
        training.employeeName,
        employeeStatusLabels[training.employeeStatus] || training.employeeStatus,
        training.department,
        training.trainer,
        training.company,
        training.note || "",
      ]);

      autoTable(doc, {
        head: [["Datum", "Typ školení", "Os. číslo", "Jméno", "Stav", "Středisko", "Školitel", "Firma", "Poznámka"]],
        body: tableData,
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      const timestamp = new Date().toISOString().split("T")[0];
      doc.save(`historie_skoleni_${timestamp}.pdf`);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${filteredHistory.length} záznamů do PDF.`,
      });
    } catch (err) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    try {
      const headers = [
        "Datum",
        "Typ školení",
        "Osobní číslo",
        "Jméno",
        "Stav zaměstnance",
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
        employeeStatusLabels[training.employeeStatus] || training.employeeStatus,
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
    } catch (err) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Historie školení</h2>
        </div>
        <ErrorDisplay
          title="Nepodařilo se načíst historii"
          message={error}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Historie školení</h2>
        </div>
        <TableSkeleton columns={9} rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Historie školení</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      {/* Employee status filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Stav zaměstnance:</label>
          <Select value={employeeStatusFilter} onValueChange={setEmployeeStatusFilter}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všichni zaměstnanci</SelectItem>
              <SelectItem value="employed">Aktivní</SelectItem>
              <SelectItem value="parental_leave">Mateřská/rodičovská</SelectItem>
              <SelectItem value="sick_leave">Nemocenská</SelectItem>
              <SelectItem value="terminated">Ukončený</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

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
        totalCount={trainings.length}
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
                <TableHead>Stav zaměstnance</TableHead>
                <TableHead>Středisko</TableHead>
                <TableHead>Školitel</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Poznámka</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                    <TableCell>
                      <Badge className={employeeStatusColors[training.employeeStatus]}>
                        {employeeStatusLabels[training.employeeStatus] || training.employeeStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{training.department}</TableCell>
                    <TableCell className="whitespace-nowrap">{training.trainer}</TableCell>
                    <TableCell className="whitespace-nowrap">{training.company}</TableCell>
                    <TableCell>{training.note || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="font-medium">Stav zaměstnance:</span>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
          <span>Aktivní</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
          <span>Mateřská/rodičovská</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-500" />
          <span>Nemocenská</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
          <span>Ukončený</span>
        </div>
      </div>
    </div>
  );
}
