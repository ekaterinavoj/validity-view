import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Building2, Calendar, CheckCircle, AlertCircle, XCircle, Users, FileSpreadsheet, FileDown } from "lucide-react";
import { Training } from "@/types/training";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Mock data - později nahradíme reálnými daty z databáze
const mockTrainings: Training[] = [
  {
    id: "1",
    status: "valid",
    date: "2025-12-15",
    type: "BOZP - Základní",
    employeeNumber: "12345",
    employeeName: "Jan Novák",
    facility: "Qlar Czech s.r.o.",
    department: "Výroba",
    lastTrainingDate: "2024-12-15",
    trainer: "Petr Svoboda",
    company: "BOZP Servis s.r.o.",
    requester: "Marie Procházková",
    period: 365,
    reminderTemplate: "Standardní",
    calendar: "Ano",
    note: "",
    is_active: true,
  },
  {
    id: "2",
    status: "warning",
    date: "2025-01-20",
    type: "Práce ve výškách",
    employeeNumber: "12346",
    employeeName: "Petr Dvořák",
    facility: "Qlar Czech s.r.o.",
    department: "Údržba",
    lastTrainingDate: "2023-01-20",
    trainer: "Tomáš Černý",
    company: "Výškové práce s.r.o.",
    requester: "Marie Procházková",
    period: 730,
    reminderTemplate: "Urgentní",
    calendar: "Ano",
    note: "",
    is_active: true,
  },
  {
    id: "3",
    status: "expired",
    date: "2024-11-01",
    type: "Řidičský průkaz VZV",
    employeeNumber: "12347",
    employeeName: "Jana Svobodová",
    facility: "Qlar Czech s.r.o.",
    department: "Logistika",
    lastTrainingDate: "2019-11-01",
    trainer: "Jiří Malý",
    company: "VZV Školení s.r.o.",
    requester: "Marie Procházková",
    period: 1825,
    reminderTemplate: "Standardní",
    calendar: "Ne",
    note: "",
    is_active: true,
  },
  {
    id: "4",
    status: "valid",
    date: "2025-06-10",
    type: "BOZP - Základní",
    employeeNumber: "12348",
    employeeName: "Martin Kučera",
    facility: "Qlar Czech s.r.o.",
    department: "Výroba",
    lastTrainingDate: "2024-06-10",
    trainer: "Petr Svoboda",
    company: "BOZP Servis s.r.o.",
    requester: "Marie Procházková",
    period: 365,
    reminderTemplate: "Standardní",
    calendar: "Ano",
    note: "",
    is_active: true,
  },
  {
    id: "5",
    status: "warning",
    date: "2025-01-25",
    type: "HSE - REA/RR",
    employeeNumber: "12349",
    employeeName: "Eva Nováková",
    facility: "Qlar Czech s.r.o.",
    department: "Administrativa",
    lastTrainingDate: "2024-01-25",
    trainer: "Blanka Hodková",
    company: "Schenck Process",
    requester: "Marie Procházková",
    period: 365,
    reminderTemplate: "Urgentní",
    calendar: "Ano",
    note: "",
    is_active: true,
  },
  {
    id: "6",
    status: "valid",
    date: "2025-08-15",
    type: "BOZP - Základní",
    employeeNumber: "12350",
    employeeName: "Karel Novotný",
    facility: "Qlar Czech s.r.o.",
    department: "Výroba",
    lastTrainingDate: "2024-08-15",
    trainer: "Petr Svoboda",
    company: "BOZP Servis s.r.o.",
    requester: "Marie Procházková",
    period: 365,
    reminderTemplate: "Standardní",
    calendar: "Ano",
    note: "",
    is_active: true,
  },
];

export default function DepartmentDashboard() {
  const { toast } = useToast();
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  // Získat seznam unikátních oddělení
  const departments = ["all", ...new Set(mockTrainings.map(t => t.department))];

  // Filtrovat školení podle vybraného oddělení
  const filteredTrainings = selectedDepartment === "all"
    ? mockTrainings
    : mockTrainings.filter(t => t.department === selectedDepartment);

  // Statistiky
  const totalTrainings = filteredTrainings.length;
  const validTrainings = filteredTrainings.filter(t => t.status === "valid").length;
  const warningTrainings = filteredTrainings.filter(t => t.status === "warning").length;
  const expiredTrainings = filteredTrainings.filter(t => t.status === "expired").length;
  const uniqueEmployees = new Set(filteredTrainings.map(t => t.employeeNumber)).size;

  // Data pro pie chart - přehled platnosti
  const pieData = [
    { name: "Platné", value: validTrainings, fill: "hsl(var(--status-valid))" },
    { name: "Brzy vyprší", value: warningTrainings, fill: "hsl(var(--status-warning))" },
    { name: "Prošlé", value: expiredTrainings, fill: "hsl(var(--status-expired))" },
  ].filter(item => item.value > 0);

  // Data pro bar chart - podle typu školení
  const trainingsByType = filteredTrainings.reduce((acc, training) => {
    if (!acc[training.type]) {
      acc[training.type] = { valid: 0, warning: 0, expired: 0 };
    }
    acc[training.type][training.status]++;
    return acc;
  }, {} as Record<string, { valid: number; warning: number; expired: number }>);

  const barData = Object.entries(trainingsByType).map(([type, stats]) => ({
    typ: type,
    platné: stats.valid,
    "brzy vyprší": stats.warning,
    prošlé: stats.expired,
  }));

  // Časová osa - školení v příštích měsících
  const today = new Date();
  const timelineData = Array.from({ length: 6 }, (_, i) => {
    const monthDate = new Date(today);
    monthDate.setMonth(monthDate.getMonth() + i);
    const monthName = monthDate.toLocaleDateString("cs-CZ", { month: "short" });
    
    const count = filteredTrainings.filter(t => {
      const trainingDate = new Date(t.date);
      return trainingDate.getMonth() === monthDate.getMonth() && 
             trainingDate.getFullYear() === monthDate.getFullYear();
    }).length;

    return { měsíc: monthName, počet: count };
  });

  const chartConfig = {
    valid: {
      label: "Platné",
      color: "hsl(var(--status-valid))",
    },
    warning: {
      label: "Brzy vyprší",
      color: "hsl(var(--status-warning))",
    },
    expired: {
      label: "Prošlé",
      color: "hsl(var(--status-expired))",
    },
  };

  // Export do Excel
  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // List 1: Statistiky
      const statsData = [
        ['Oddeleni', selectedDepartment === "all" ? "Vsechna oddeleni" : selectedDepartment],
        ['Celkem skoleni', totalTrainings],
        ['Platne skoleni', validTrainings],
        ['Brzy vyprsi', warningTrainings],
        ['Prosle skoleni', expiredTrainings],
        ['Skoleni zamestnancu', uniqueEmployees],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(statsData);
      ws1['!cols'] = [{ wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Statistiky');

      // List 2: Podle typu
      const typeData = [
        ['Typ skoleni', 'Platne', 'Brzy vyprsi', 'Prosle'],
        ...barData.map(d => [d.typ, d.platné, d['brzy vyprší'], d.prošlé])
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(typeData);
      ws2['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Podle typu');

      // List 3: Seznam školení
      const trainingData = [
        ['Stav', 'Platne do', 'Typ', 'Cislo', 'Jmeno', 'Skolitel'],
        ...filteredTrainings.map(t => [
          t.status === 'valid' ? 'Platne' : t.status === 'warning' ? 'Brzy vyprsi' : 'Prosle',
          new Date(t.date).toLocaleDateString("cs-CZ"),
          t.type,
          t.employeeNumber,
          t.employeeName,
          t.trainer || ''
        ])
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(trainingData);
      ws3['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Seznam skoleni');

      const timestamp = new Date().toISOString().split('T')[0];
      const deptName = selectedDepartment === "all" ? "vsechna" : selectedDepartment.toLowerCase().replace(/\s+/g, '_');
      XLSX.writeFile(wb, `oddeleni_${deptName}_${timestamp}.xlsx`, {
        bookType: 'xlsx',
        type: 'binary'
      });

      toast({
        title: "Export dokončen",
        description: "Data oddělení byla exportována do Excel souboru.",
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

  // Export do PDF
  const exportToPDF = () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;

      // Nadpis
      pdf.setFontSize(20);
      const deptTitle = selectedDepartment === "all" ? "Vsechna oddeleni" : selectedDepartment;
      pdf.text(`Dashboard oddeleni: ${deptTitle}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Datum
      pdf.setFontSize(10);
      const date = new Date().toLocaleDateString('cs-CZ');
      pdf.text(`Vygenerovano: ${date}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Statistiky
      pdf.setFontSize(14);
      pdf.text('Celkove statistiky', 15, yPosition);
      yPosition += 5;

      autoTable(pdf, {
        startY: yPosition,
        head: [['Statistika', 'Hodnota']],
        body: [
          ['Celkem skoleni', totalTrainings.toString()],
          ['Platne skoleni', validTrainings.toString()],
          ['Brzy vyprsi', warningTrainings.toString()],
          ['Prosle skoleni', expiredTrainings.toString()],
          ['Skoleni zamestnancu', uniqueEmployees.toString()],
        ],
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: 15 },
      });

      yPosition = (pdf as any).lastAutoTable.finalY + 15;

      // Podle typu
      pdf.setFontSize(14);
      pdf.text('Skoleni podle typu', 15, yPosition);
      yPosition += 5;

      autoTable(pdf, {
        startY: yPosition,
        head: [['Typ skoleni', 'Platne', 'Brzy vyprsi', 'Prosle']],
        body: barData.map(d => [
          d.typ,
          d.platné.toString(),
          d['brzy vyprší'].toString(),
          d.prošlé.toString()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: 15 },
      });

      const timestamp = new Date().toISOString().split('T')[0];
      const deptName = selectedDepartment === "all" ? "vsechna" : selectedDepartment.toLowerCase().replace(/\s+/g, '_');
      pdf.save(`oddeleni_${deptName}_${timestamp}.pdf`);

      toast({
        title: "Export dokončen",
        description: "Dashboard byl exportován do PDF souboru.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat dashboard do PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Dashboard oddělení</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={exportToPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Výběr oddělení */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Building2 className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">Vyberte oddělení:</span>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechna oddělení</SelectItem>
              {departments.filter(d => d !== "all").map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Statistiky */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Celkem školení</p>
              <p className="text-2xl font-bold">{totalTrainings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-status-valid/10 rounded-lg">
              <CheckCircle className="w-6 h-6 text-status-valid" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Platné</p>
              <p className="text-2xl font-bold">{validTrainings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-status-warning/10 rounded-lg">
              <AlertCircle className="w-6 h-6 text-status-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Brzy vyprší</p>
              <p className="text-2xl font-bold">{warningTrainings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-status-expired/10 rounded-lg">
              <XCircle className="w-6 h-6 text-status-expired" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Prošlé</p>
              <p className="text-2xl font-bold">{expiredTrainings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Zaměstnanců</p>
              <p className="text-2xl font-bold">{uniqueEmployees}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Grafy */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie Chart - Přehled platnosti */}
        {pieData.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Přehled platnosti školení</h3>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </Card>
        )}

        {/* Bar Chart - Podle typu školení */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Školení podle typu</h3>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="typ" 
                  stroke="hsl(var(--foreground))"
                  fontSize={11}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="platné" fill="hsl(var(--status-valid))" />
                <Bar dataKey="brzy vyprší" fill="hsl(var(--status-warning))" />
                <Bar dataKey="prošlé" fill="hsl(var(--status-expired))" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>

        {/* Line Chart - Časová osa */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Časová osa - Příštích 6 měsíců</h3>
          <ChartContainer config={{ počet: { label: "Počet školení", color: "hsl(var(--chart-1))" }}} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="měsíc" 
                  stroke="hsl(var(--foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="počet" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>
      </div>

      {/* Seznam školení */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Seznam školení</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium">Stav</th>
                <th className="text-left py-3 px-4 font-medium">Zaměstnanec</th>
                <th className="text-left py-3 px-4 font-medium">Typ školení</th>
                <th className="text-left py-3 px-4 font-medium">Platné do</th>
                <th className="text-left py-3 px-4 font-medium">Školitel</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrainings.map((training) => (
                <tr key={training.id} className="border-b border-border hover:bg-accent/50">
                  <td className="py-3 px-4">
                    <StatusBadge status={training.status} />
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium">{training.employeeName}</p>
                      <p className="text-sm text-muted-foreground">{training.employeeNumber}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">{training.type}</td>
                  <td className="py-3 px-4">
                    {new Date(training.date).toLocaleDateString("cs-CZ")}
                  </td>
                  <td className="py-3 px-4 text-sm">{training.trainer}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTrainings.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Žádná školení pro vybrané oddělení
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
