import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { UserCheck, Calendar, Award, TrendingUp, FileSpreadsheet, FileDown } from "lucide-react";
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
];

export default function TrainersOverview() {
  const { toast } = useToast();
  const [selectedTrainer, setSelectedTrainer] = useState<string>("all");

  // Získat seznam unikátních školitelů
  const trainers = ["all", ...new Set(mockTrainings.map(t => t.trainer).filter(Boolean))];

  // Filtrovat školení podle vybraného školitele
  const filteredTrainings = selectedTrainer === "all"
    ? mockTrainings
    : mockTrainings.filter(t => t.trainer === selectedTrainer);

  // Statistiky pro vybraného školitele
  const totalTrainings = filteredTrainings.length;
  const uniqueEmployees = new Set(filteredTrainings.map(t => t.employeeNumber)).size;
  const uniqueTrainingTypes = new Set(filteredTrainings.map(t => t.type)).size;
  
  // Školení podle statusu
  const validCount = filteredTrainings.filter(t => t.status === "valid").length;
  const warningCount = filteredTrainings.filter(t => t.status === "warning").length;
  const expiredCount = filteredTrainings.filter(t => t.status === "expired").length;

  // Statistiky všech školitelů (pro přehled)
  const trainerStats = Array.from(new Set(mockTrainings.map(t => t.trainer).filter(Boolean))).map(trainer => {
    const trainerTrainings = mockTrainings.filter(t => t.trainer === trainer);
    return {
      name: trainer,
      celkem: trainerTrainings.length,
      zaměstnanců: new Set(trainerTrainings.map(t => t.employeeNumber)).size,
      typů: new Set(trainerTrainings.map(t => t.type)).size,
    };
  }).sort((a, b) => b.celkem - a.celkem);

  // Data pro pie chart - podle statusu
  const pieData = [
    { name: "Platné", value: validCount, fill: "hsl(var(--status-valid))" },
    { name: "Brzy vyprší", value: warningCount, fill: "hsl(var(--status-warning))" },
    { name: "Prošlé", value: expiredCount, fill: "hsl(var(--status-expired))" },
  ].filter(item => item.value > 0);

  // Data pro bar chart - školení podle typu
  const trainingsByType = filteredTrainings.reduce((acc, training) => {
    acc[training.type] = (acc[training.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.entries(trainingsByType)
    .map(([typ, počet]) => ({ typ, počet }))
    .sort((a, b) => b.počet - a.počet);

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

      // List 1: Statistiky školitele
      const statsData = [
        ['Skolitel', selectedTrainer === "all" ? "Vsichni skolitele" : selectedTrainer],
        ['Celkem skoleni', totalTrainings],
        ['Skoleno zamestnancu', uniqueEmployees],
        ['Typu skoleni', uniqueTrainingTypes],
        ['Platne skoleni', validCount],
        ['Brzy vyprsi', warningCount],
        ['Prosle skoleni', expiredCount],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(statsData);
      ws1['!cols'] = [{ wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Statistiky');

      // List 2: Přehled všech školitelů
      if (selectedTrainer === "all") {
        const trainerData = [
          ['Skolitel', 'Celkem skoleni', 'Zamestnancu', 'Typu'],
          ...trainerStats.map(t => [t.name, t.celkem, t.zaměstnanců, t.typů])
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(trainerData);
        ws2['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Prehled skolitelu');
      }

      // List 3: Seznam školení
      const trainingData = [
        ['Stav', 'Datum', 'Typ', 'Zamestnanec', 'Cislo', 'Oddeleni'],
        ...filteredTrainings.map(t => [
          t.status === 'valid' ? 'Platne' : t.status === 'warning' ? 'Brzy vyprsi' : 'Prosle',
          new Date(t.lastTrainingDate).toLocaleDateString("cs-CZ"),
          t.type,
          t.employeeName,
          t.employeeNumber,
          t.department
        ])
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(trainingData);
      ws3['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Seznam skoleni');

      const timestamp = new Date().toISOString().split('T')[0];
      const trainerName = selectedTrainer === "all" ? "vsichni" : selectedTrainer.toLowerCase().replace(/\s+/g, '_');
      XLSX.writeFile(wb, `skolitel_${trainerName}_${timestamp}.xlsx`, {
        bookType: 'xlsx',
        type: 'binary'
      });

      toast({
        title: "Export dokončen",
        description: "Data školitele byla exportována do Excel souboru.",
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
      const trainerTitle = selectedTrainer === "all" ? "Vsichni skolitele" : selectedTrainer;
      pdf.text(`Prehled skolitele: ${trainerTitle}`, pageWidth / 2, yPosition, { align: 'center' });
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
          ['Skoleno zamestnancu', uniqueEmployees.toString()],
          ['Typu skoleni', uniqueTrainingTypes.toString()],
          ['Platne skoleni', validCount.toString()],
          ['Brzy vyprsi', warningCount.toString()],
          ['Prosle skoleni', expiredCount.toString()],
        ],
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: 15 },
      });

      yPosition = (pdf as any).lastAutoTable.finalY + 15;

      // Podle typu školení
      if (barData.length > 0) {
        pdf.setFontSize(14);
        pdf.text('Skoleni podle typu', 15, yPosition);
        yPosition += 5;

        autoTable(pdf, {
          startY: yPosition,
          head: [['Typ skoleni', 'Pocet']],
          body: barData.map(d => [d.typ, d.počet.toString()]),
          theme: 'striped',
          headStyles: { fillColor: [66, 66, 66] },
          margin: { left: 15 },
        });
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const trainerName = selectedTrainer === "all" ? "vsichni" : selectedTrainer.toLowerCase().replace(/\s+/g, '_');
      pdf.save(`skolitel_${trainerName}_${timestamp}.pdf`);

      toast({
        title: "Export dokončen",
        description: "Přehled školitele byl exportován do PDF souboru.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat přehled do PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Přehled školitelů</h2>
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

      {/* Výběr školitele */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <UserCheck className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">Vyberte školitele:</span>
          <Select value={selectedTrainer} onValueChange={setSelectedTrainer}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všichni školitelé</SelectItem>
              {trainers.filter(t => t !== "all").map(trainer => (
                <SelectItem key={trainer} value={trainer}>{trainer}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Statistiky */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <UserCheck className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Školeno zaměstnanců</p>
              <p className="text-2xl font-bold">{uniqueEmployees}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Award className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Typů školení</p>
              <p className="text-2xl font-bold">{uniqueTrainingTypes}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Úspěšnost</p>
              <p className="text-2xl font-bold">
                {totalTrainings > 0 ? Math.round((validCount / totalTrainings) * 100) : 0}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Grafy */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie Chart - Přehled statusů */}
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
          <ChartContainer config={{ počet: { label: "Počet", color: "hsl(var(--chart-1))" }}} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--foreground))" />
                <YAxis 
                  type="category" 
                  dataKey="typ" 
                  stroke="hsl(var(--foreground))"
                  width={150}
                  fontSize={11}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="počet" fill="hsl(var(--chart-1))" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>
      </div>

      {/* Přehled všech školitelů */}
      {selectedTrainer === "all" && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Srovnání školitelů</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium">Školitel</th>
                  <th className="text-right py-3 px-4 font-medium">Celkem školení</th>
                  <th className="text-right py-3 px-4 font-medium">Zaměstnanců</th>
                  <th className="text-right py-3 px-4 font-medium">Typů školení</th>
                </tr>
              </thead>
              <tbody>
                {trainerStats.map((trainer, index) => (
                  <tr key={index} className="border-b border-border hover:bg-accent/50">
                    <td className="py-3 px-4 font-medium">{trainer.name}</td>
                    <td className="text-right py-3 px-4">{trainer.celkem}</td>
                    <td className="text-right py-3 px-4">{trainer.zaměstnanců}</td>
                    <td className="text-right py-3 px-4">{trainer.typů}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Historie školení */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Historie školení</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium">Stav</th>
                <th className="text-left py-3 px-4 font-medium">Datum</th>
                <th className="text-left py-3 px-4 font-medium">Typ školení</th>
                <th className="text-left py-3 px-4 font-medium">Zaměstnanec</th>
                <th className="text-left py-3 px-4 font-medium">Oddělení</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrainings.map((training) => (
                <tr key={training.id} className="border-b border-border hover:bg-accent/50">
                  <td className="py-3 px-4">
                    <StatusBadge status={training.status} />
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {new Date(training.lastTrainingDate).toLocaleDateString("cs-CZ")}
                  </td>
                  <td className="py-3 px-4">{training.type}</td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium">{training.employeeName}</p>
                      <p className="text-sm text-muted-foreground">{training.employeeNumber}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">{training.department}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTrainings.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Žádná školení pro vybraného školitele
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
