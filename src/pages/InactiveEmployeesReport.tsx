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
import { Training } from "@/types/training";
import { Download, UserX, Calendar } from "lucide-react";
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

// Mock data - zaměstnanci s neaktivními statusy
const mockInactiveEmployees = [
  {
    id: "emp1",
    employeeNumber: "12351",
    firstName: "Martina",
    lastName: "Dvořáková",
    email: "martina.dvorakova@qlar.cz",
    position: "Operátor výroby",
    department: "Výroba",
    status: "parental_leave" as const,
  },
  {
    id: "emp2",
    employeeNumber: "12352",
    firstName: "Tomáš",
    lastName: "Black",
    email: "tomas.black@qlar.cz",
    position: "Technik údržby",
    department: "Údržba",
    status: "sick_leave" as const,
  },
  {
    id: "emp3",
    employeeNumber: "12353",
    firstName: "Petr",
    lastName: "Veselý",
    email: "petr.vesely@qlar.cz",
    position: "Skladník",
    department: "Logistika",
    status: "terminated" as const,
  },
];

// Mock data - deaktivovaná školení
const mockInactiveTrainings: (Training & { employeeId: string })[] = [
  {
    id: "train1",
    employeeId: "emp1",
    status: "valid",
    date: "2025-05-15",
    type: "BOZP - Základní",
    employeeNumber: "12351",
    employeeName: "Martina Dvořáková",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
    department: "Výroba",
    lastTrainingDate: "2024-05-15",
    trainer: "Petr Svoboda",
    company: "BOZP Servis s.r.o.",
    requester: "Marie Procházková",
    period: 365,
    reminderTemplate: "Standardní",
    calendar: "Ano",
    note: "Pozastaveno - rodičovská dovolená",
    is_active: false,
  },
  {
    id: "train2",
    employeeId: "emp1",
    status: "warning",
    date: "2025-02-20",
    type: "Práce ve výškách",
    employeeNumber: "12351",
    employeeName: "Martina Dvořáková",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
    department: "Výroba",
    lastTrainingDate: "2023-02-20",
    trainer: "Tomáš Černý",
    company: "Výškové práce s.r.o.",
    requester: "Marie Procházková",
    period: 730,
    reminderTemplate: "Urgentní",
    calendar: "Ano",
    note: "Pozastaveno - rodičovská dovolená",
    is_active: false,
  },
  {
    id: "train3",
    employeeId: "emp2",
    status: "valid",
    date: "2025-08-10",
    type: "BOZP - Základní",
    employeeNumber: "12352",
    employeeName: "Tomáš Black",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
    department: "Údržba",
    lastTrainingDate: "2024-08-10",
    trainer: "Petr Svoboda",
    company: "BOZP Servis s.r.o.",
    requester: "Marie Procházková",
    period: 365,
    reminderTemplate: "Standardní",
    calendar: "Ano",
    note: "Pozastaveno - nemocenská",
    is_active: false,
  },
  {
    id: "train4",
    employeeId: "emp3",
    status: "expired",
    date: "2024-09-01",
    type: "Řidičský průkaz VZV",
    employeeNumber: "12353",
    employeeName: "Petr Veselý",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
    department: "Logistika",
    lastTrainingDate: "2019-09-01",
    trainer: "Jiří Malý",
    company: "VZV Školení s.r.o.",
    requester: "Marie Procházková",
    period: 1825,
    reminderTemplate: "Standardní",
    calendar: "Ne",
    note: "Ukončeno - zaměstnanec již nepracuje",
    is_active: false,
  },
];

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

  const filteredEmployees = useMemo(() => {
    if (statusFilter === "all") {
      return mockInactiveEmployees;
    }
    return mockInactiveEmployees.filter((emp) => emp.status === statusFilter);
  }, [statusFilter]);

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
    return mockInactiveTrainings.filter((t) => t.employeeId === employeeId);
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
        description: `Exportováno ${rows.length} pozastavených školení.`,
      });
    } catch (error) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  const totalInactiveTrainings = mockInactiveTrainings.length;
  const totalInactiveEmployees = mockInactiveEmployees.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Pozastavená školení</h2>
          <p className="text-muted-foreground mt-2">
            Přehled zaměstnanců s neaktivním statusem a jejich dočasně pozastavených školení
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
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
              <p className="text-2xl font-bold">
                {mockInactiveEmployees.filter((e) => e.status === "parental_leave").length}
              </p>
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
                            {trainings.length} {trainings.length === 1 ? "školení" : "školení"}
                          </Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t">
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
