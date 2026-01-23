import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, UserX, Calendar, Loader2, RefreshCw, FileSpreadsheet, FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPeriodicity } from "@/lib/utils";
import { useInactiveEmployees } from "@/hooks/useEmployees";
import { useTrainings } from "@/hooks/useTrainings";
import { CardsSkeleton, TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const statusLabels = {
  employed: "Zaměstnaný",
  parental_leave: "Rodičovská dovolená",
  sick_leave: "Nemocenská",
  terminated: "Již nepracuje",
};

const statusColors = {
  employed: "bg-green-500",
  parental_leave: "bg-blue-500",
  sick_leave: "bg-yellow-500",
  terminated: "bg-red-500",
};

export default function InactiveEmployeesReport() {
  const { toast } = useToast();
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { employees: inactiveEmployees, loading: employeesLoading, error: employeesError, refetch: refetchEmployees } = useInactiveEmployees();
  const { trainings: inactiveTrainings, loading: trainingsLoading, error: trainingsError, refetch: refetchTrainings } = useTrainings(false);

  const filteredEmployees = useMemo(() => {
    if (statusFilter === "all") {
      return inactiveEmployees;
    }
    return inactiveEmployees.filter((emp) => emp.status === statusFilter);
  }, [statusFilter, inactiveEmployees]);

  const toggleEmployee = (employeeId: string) => {
    const newExpanded = new Set(expandedEmployees);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedEmployees(newExpanded);
  };

  const getTrainingsForEmployee = (employeeId: string) => {
    return inactiveTrainings.filter((t) => t.employeeId === employeeId);
  };

  const exportToExcel = () => {
    try {
      const rows: any[] = [];
      filteredEmployees.forEach((employee) => {
        const trainings = getTrainingsForEmployee(employee.id);
        if (trainings.length === 0) {
          rows.push({
            "Osobní číslo": employee.employeeNumber,
            "Jméno": `${employee.firstName} ${employee.lastName}`,
            "Email": employee.email,
            "Pozice": employee.position,
            "Středisko": employee.department,
            "Stav zaměstnance": statusLabels[employee.status],
            "Typ školení": "-",
            "Školení platné do": "-",
            "Datum školení": "-",
            "Stav školení": "-",
          });
        } else {
          trainings.forEach((training) => {
            rows.push({
              "Osobní číslo": employee.employeeNumber,
              "Jméno": `${employee.firstName} ${employee.lastName}`,
              "Email": employee.email,
              "Pozice": employee.position,
              "Středisko": employee.department,
              "Stav zaměstnance": statusLabels[employee.status],
              "Typ školení": training.type,
              "Školení platné do": new Date(training.date).toLocaleDateString("cs-CZ"),
              "Datum školení": new Date(training.lastTrainingDate).toLocaleDateString("cs-CZ"),
              "Stav školení": training.status === "valid" ? "Platné" : training.status === "warning" ? "Brzy vyprší" : "Prošlé",
            });
          });
        }
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Neaktivní zaměstnanci");
      
      const timestamp = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `neaktivni_zamestnanci_${timestamp}.xlsx`);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${rows.length} záznamů do Excel.`,
      });
    } catch (error) {
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
      doc.text("Pozastavená školení", 14, 15);
      doc.setFontSize(10);
      doc.text(`Vygenerováno: ${new Date().toLocaleDateString("cs-CZ")}`, 14, 22);

      const tableData: string[][] = [];
      filteredEmployees.forEach((employee) => {
        const trainings = getTrainingsForEmployee(employee.id);
        if (trainings.length === 0) {
          tableData.push([
            employee.employeeNumber,
            `${employee.firstName} ${employee.lastName}`,
            employee.position,
            employee.department,
            statusLabels[employee.status],
            "-",
            "-",
            "-",
          ]);
        } else {
          trainings.forEach((training) => {
            tableData.push([
              employee.employeeNumber,
              `${employee.firstName} ${employee.lastName}`,
              employee.position,
              employee.department,
              statusLabels[employee.status],
              training.type,
              new Date(training.date).toLocaleDateString("cs-CZ"),
              training.status === "valid" ? "Platné" : training.status === "warning" ? "Brzy vyprší" : "Prošlé",
            ]);
          });
        }
      });

      autoTable(doc, {
        head: [["Os. číslo", "Jméno", "Pozice", "Středisko", "Stav", "Typ školení", "Platné do", "Stav školení"]],
        body: tableData,
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      const timestamp = new Date().toISOString().split("T")[0];
      doc.save(`neaktivni_zamestnanci_${timestamp}.pdf`);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${tableData.length} záznamů do PDF.`,
      });
    } catch (error) {
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
        "Osobní číslo",
        "Jméno",
        "Email",
        "Pozice",
        "Středisko",
        "Stav zaměstnance",
        "Typ školení",
        "Školení platné do",
        "Datum školení",
        "Stav školení",
        "Poznámka",
      ];

      const rows: string[][] = [];
      filteredEmployees.forEach((employee) => {
        const trainings = getTrainingsForEmployee(employee.id);
        if (trainings.length === 0) {
          // Include employee even without trainings
          rows.push([
            employee.employeeNumber,
            `${employee.firstName} ${employee.lastName}`,
            employee.email,
            employee.position,
            employee.department,
            statusLabels[employee.status],
            "-",
            "-",
            "-",
            "-",
            "-",
          ]);
        } else {
          trainings.forEach((training) => {
            rows.push([
              employee.employeeNumber,
              `${employee.firstName} ${employee.lastName}`,
              employee.email,
              employee.position,
              employee.department,
              statusLabels[employee.status],
              training.type,
              new Date(training.date).toLocaleDateString("cs-CZ"),
              new Date(training.lastTrainingDate).toLocaleDateString("cs-CZ"),
              training.status === "valid" ? "Platné" : training.status === "warning" ? "Brzy vyprší" : "Prošlé",
              training.note,
            ]);
          });
        }
      });

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
      link.setAttribute("download", `neaktivni_zamestnanci_${timestamp}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${rows.length} záznamů.`,
      });
    } catch (error) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  const totalInactiveTrainings = inactiveTrainings.length;
  const totalInactiveEmployees = inactiveEmployees.length;
  const parentalLeaveCount = inactiveEmployees.filter((e) => e.status === "parental_leave").length;

  const refetch = () => {
    refetchEmployees();
    refetchTrainings();
  };

  if (employeesError || trainingsError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Pozastavená školení</h2>
        </div>
        <ErrorDisplay
          title="Nepodařilo se načíst data"
          message={employeesError || trainingsError || "Zkuste to prosím znovu."}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (employeesLoading || trainingsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Pozastavená školení</h2>
        </div>
        <CardsSkeleton count={3} />
        <TableSkeleton columns={7} rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Pozastavená školení</h2>
          <p className="text-muted-foreground mt-2">
            Přehled zaměstnanců s neaktivním statusem a jejich dočasně pozastavených školení
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Statistiky */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <UserX className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Neaktivní zaměstnanci</p>
              <p className="text-2xl font-bold">{totalInactiveEmployees}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pozastavená školení</p>
              <p className="text-2xl font-bold">{totalInactiveTrainings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rodičovská dovolená</p>
              <p className="text-2xl font-bold">{parentalLeaveCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtr */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Filtrovat podle statusu:</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny statusy</SelectItem>
              <SelectItem value="parental_leave">Rodičovská dovolená</SelectItem>
              <SelectItem value="sick_leave">Nemocenská</SelectItem>
              <SelectItem value="terminated">Již nepracuje</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Seznam zaměstnanců */}
      <Card className="p-6">
        <div className="space-y-4">
          {filteredEmployees.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Žádní neaktivní zaměstnanci nenalezeni
            </p>
          ) : (
            filteredEmployees.map((employee) => {
              const trainings = getTrainingsForEmployee(employee.id);
              const isExpanded = expandedEmployees.has(employee.id);

              return (
                <Collapsible key={employee.id} open={isExpanded} onOpenChange={() => toggleEmployee(employee.id)}>
                  <Card className="border-2">
                    <CollapsibleTrigger asChild>
                      <div className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h3 className="font-semibold text-lg">
                                  {employee.firstName} {employee.lastName}
                                </h3>
                                <Badge variant="secondary">{employee.employeeNumber}</Badge>
                                <Badge className={statusColors[employee.status]}>
                                  {statusLabels[employee.status]}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                <span>{employee.position}</span>
                                <span>•</span>
                                <span>{employee.department}</span>
                                <span>•</span>
                                <span>{employee.email}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-orange-500 border-orange-500">
                            {trainings.length} školení
                          </Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t">
                        {trainings.length === 0 ? (
                          <p className="text-center py-4 text-muted-foreground text-sm">
                            Žádná školení k zobrazení
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Typ školení</TableHead>
                                <TableHead>Školení platné do</TableHead>
                                <TableHead>Datum školení</TableHead>
                                <TableHead>Periodicita</TableHead>
                                <TableHead>Školitel</TableHead>
                                <TableHead>Firma</TableHead>
                                <TableHead>Poznámka</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {trainings.map((training) => (
                                <TableRow key={training.id}>
                                  <TableCell className="font-medium">{training.type}</TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {new Date(training.date).toLocaleDateString("cs-CZ")}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {new Date(training.lastTrainingDate).toLocaleDateString("cs-CZ")}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {formatPeriodicity(training.period)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">{training.trainer}</TableCell>
                                  <TableCell className="whitespace-nowrap">{training.company}</TableCell>
                                  <TableCell className="max-w-xs truncate" title={training.note}>
                                    {training.note}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })
          )}
        </div>
      </Card>

      {/* Legenda */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
          <span>Rodičovská dovolená - školení se automaticky aktivují po návratu</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-yellow-500" />
          <span>Nemocenská - školení se aktivují po ukončení nemocenské</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
          <span>Již nepracuje - školení zůstávají trvale deaktivována</span>
        </div>
      </div>
    </div>
  );
}
