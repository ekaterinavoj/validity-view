import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Training } from "@/types/training";
import { Calendar, CheckCircle, XCircle, Clock, Activity, FileDown, FileSpreadsheet, TrendingUp, Users } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EmailDeliveryStats } from "@/components/EmailDeliveryStats";

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
  {
    id: "4",
    status: "valid",
    date: "2025-06-10",
    type: "BOZP - Základní",
    employeeNumber: "12348",
    employeeName: "Martin Kučera",
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
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
    facility: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
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

export default function Statistics() {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  // Filtrovat pouze aktivní školení
  const activeTrainings = mockTrainings.filter(t => t.is_active !== false);
  
  // Základní statistiky školení
  const totalTrainings = activeTrainings.length;
  const validTrainings = activeTrainings.filter(t => t.status === "valid").length;
  const warningTrainings = activeTrainings.filter(t => t.status === "warning").length;
  const expiredTrainings = activeTrainings.filter(t => t.status === "expired").length;
  const uniqueEmployees = new Set(mockTrainings.map(t => t.employeeNumber)).size;
  
  // Školení expirující v příštích 30/60/90 dnech
  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  
  const expiring30 = activeTrainings.filter(t => {
    const date = new Date(t.date);
    return date >= today && date <= in30Days;
  }).length;
  
  const expiring60 = activeTrainings.filter(t => {
    const date = new Date(t.date);
    return date >= today && date <= in60Days;
  }).length;
  
  const expiring90 = activeTrainings.filter(t => {
    const date = new Date(t.date);
    return date >= today && date <= in90Days;
  }).length;

  // Data pro trendy
  const trendData = [
    { month: "Červen", dokončeno: 12, naplánováno: 8 },
    { month: "Červenec", dokončeno: 15, naplánováno: 10 },
    { month: "Srpen", dokončeno: 8, naplánováno: 6 },
    { month: "Září", dokončeno: 18, naplánováno: 12 },
    { month: "Říjen", dokončeno: 14, naplánováno: 9 },
    { month: "Listopad", dokončeno: 20, naplánováno: 15 },
  ];

  // Data pro bar chart - školení podle oddělení
  const departmentStats = mockTrainings.reduce((acc, training) => {
    const dept = training.department;
    if (!acc[dept]) {
      acc[dept] = { valid: 0, warning: 0, expired: 0 };
    }
    acc[dept][training.status]++;
    return acc;
  }, {} as Record<string, { valid: number; warning: number; expired: number }>);

  const barData = Object.entries(departmentStats).map(([dept, stats]) => ({
    department: dept,
    platné: stats.valid,
    "brzy vyprší": stats.warning,
    prošlé: stats.expired,
  }));

  // Statistiky odškolených hodin
  const monthlyData = [
    { měsíc: "Leden", hodiny: 42, počet: 21 },
    { měsíc: "Únor", hodiny: 38, počet: 19 },
    { měsíc: "Březen", hodiny: 56, počet: 28 },
    { měsíc: "Duben", hodiny: 48, počet: 24 },
    { měsíc: "Květen", hodiny: 64, počet: 32 },
    { měsíc: "Červen", hodiny: 52, počet: 26 },
    { měsíc: "Červenec", hodiny: 36, počet: 18 },
    { měsíc: "Srpen", hodiny: 40, počet: 20 },
    { měsíc: "Září", hodiny: 72, počet: 36 },
    { měsíc: "Říjen", hodiny: 58, počet: 29 },
    { měsíc: "Listopad", hodiny: 66, počet: 33 },
    { měsíc: "Prosinec", hodiny: 44, počet: 22 },
  ];

  const trainingTypeStats = [
    { typ: "BOZP - Základní", hodiny: 84, počet: 42, prům_délka: 2 },
    { typ: "HSE - REA/RR", hodiny: 120, počet: 30, prům_délka: 4 },
    { typ: "Práce ve výškách", hodiny: 64, počet: 8, prům_délka: 8 },
    { typ: "Řidičský průkaz VZV", hodiny: 96, počet: 6, prům_délka: 16 },
    { typ: "ATEX", hodiny: 48, počet: 24, prům_délka: 2 },
  ];

  const totalHours = monthlyData.reduce((sum, item) => sum + item.hodiny, 0);
  const totalHoursTrainings = monthlyData.reduce((sum, item) => sum + item.počet, 0);
  const avgHoursPerTraining = (totalHours / totalHoursTrainings).toFixed(1);

  // Statistiky školitelů
  const trainerStats = mockTrainings.reduce((acc, training) => {
    const trainer = training.trainer;
    if (!acc[trainer]) {
      acc[trainer] = {
        total: 0,
        valid: 0,
        expired: 0,
        employees: new Set(),
        types: new Set(),
      };
    }
    acc[trainer].total++;
    if (training.status === "valid") acc[trainer].valid++;
    if (training.status === "expired") acc[trainer].expired++;
    acc[trainer].employees.add(training.employeeNumber);
    acc[trainer].types.add(training.type);
    return acc;
  }, {} as Record<string, { total: number; valid: number; expired: number; employees: Set<string>; types: Set<string> }>);

  const trainerData = Object.entries(trainerStats).map(([name, stats]) => ({
    name,
    total: stats.total,
    valid: stats.valid,
    expired: stats.expired,
    employees: stats.employees.size,
    types: stats.types.size,
  }));

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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  // Export do Excel
  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // List 1: Celkové statistiky
      const statsData = [
        ['Statistika', 'Hodnota'],
        ['Celkem skoleni', totalTrainings],
        ['Platne skoleni', validTrainings],
        ['Prosle skoleni', expiredTrainings],
        ['Vyprsi do 30 dni', expiring30],
        ['Vyprsi do 60 dni', expiring60],
        ['Vyprsi do 90 dni', expiring90],
        ['Celkem hodin', totalHours],
        ['Prumer hodin na skoleni', avgHoursPerTraining],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(statsData);
      ws1['!cols'] = [{ wch: 25 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Statistiky');

      // List 2: Školení podle oddělení
      const deptData = [
        ['Oddeleni', 'Platne', 'Prosle'],
        ...barData.map(d => [d.department, d.platné, d.prošlé])
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(deptData);
      ws2['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Podle oddeleni');

      // List 3: Odškolené hodiny podle typu
      const typeData = [
        ['Typ skoleni', 'Hodiny', 'Pocet skoleni', 'Prumerna delka'],
        ...trainingTypeStats.map(d => [d.typ, d.hodiny, d.počet, d.prům_délka])
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(typeData);
      ws3['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Podle typu');

      // List 4: Školitelé
      const trainerExportData = [
        ['Skolitel', 'Celkem skoleni', 'Platne', 'Prosle', 'Zamestnanci', 'Typy skoleni'],
        ...trainerData.map(d => [d.name, d.total, d.valid, d.expired, d.employees, d.types])
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(trainerExportData);
      ws4['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Skolitele');

      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `statistiky_${timestamp}.xlsx`, { 
        bookType: 'xlsx',
        type: 'binary'
      });

      toast({
        title: "Export dokončen",
        description: "Statistiky byly exportovány do Excel souboru.",
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
  const exportToPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;

      pdf.setFontSize(20);
      pdf.text('Statistiky skoleni', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      pdf.setFontSize(10);
      const date = new Date().toLocaleDateString('cs-CZ');
      pdf.text(`Vygenerovano: ${date}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      pdf.setFontSize(14);
      pdf.text('Celkove statistiky', 15, yPosition);
      yPosition += 5;

      autoTable(pdf, {
        startY: yPosition,
        head: [['Statistika', 'Hodnota']],
        body: [
          ['Celkem skoleni', totalTrainings.toString()],
          ['Platne skoleni', validTrainings.toString()],
          ['Prosle skoleni', expiredTrainings.toString()],
          ['Vyprsi do 30 dni', expiring30.toString()],
          ['Celkem hodin', totalHours.toString()],
          ['Prumer hodin/skoleni', avgHoursPerTraining],
        ],
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: 15 },
      });

      yPosition = (pdf as any).lastAutoTable.finalY + 15;

      pdf.setFontSize(14);
      pdf.text('Skoleni podle oddeleni', 15, yPosition);
      yPosition += 5;

      autoTable(pdf, {
        startY: yPosition,
        head: [['Oddeleni', 'Platne', 'Prosle']],
        body: barData.map(d => [
          d.department,
          d.platné.toString(),
          d.prošlé.toString()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: 15 },
      });

      const timestamp = new Date().toISOString().split('T')[0];
      pdf.save(`statistiky_${timestamp}.pdf`);

      toast({
        title: "Export dokončen",
        description: "Statistiky byly exportovány do PDF souboru.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat statistiky do PDF.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Statistika</h2>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export do Excel
          </Button>
          <Button variant="outline" onClick={exportToPDF}>
            <FileDown className="w-4 h-4 mr-2" />
            Export do PDF
          </Button>
        </div>
      </div>

      {/* Statistiky */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              <p className="text-sm text-muted-foreground">Platné školení</p>
              <p className="text-2xl font-bold">{validTrainings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-status-expired/10 rounded-lg">
              <XCircle className="w-6 h-6 text-status-expired" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Prošlé školení</p>
              <p className="text-2xl font-bold">{expiredTrainings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <Clock className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vyprší do 30 dní</p>
              <p className="text-2xl font-bold">{expiring30}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vyprší do 60 dní</p>
              <p className="text-2xl font-bold">{expiring60}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Activity className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vyprší do 90 dní</p>
              <p className="text-2xl font-bold">{expiring90}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unikátní zaměstnanci</p>
              <p className="text-2xl font-bold">{uniqueEmployees}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Clock className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Celkem odškoleno hodin</p>
              <p className="text-2xl font-bold">{totalHours}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-teal-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Průměr hodin/školení</p>
              <p className="text-2xl font-bold">{avgHoursPerTraining}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Grafy */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bar Chart - Podle oddělení */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Školení podle oddělení</h3>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="department" 
                  stroke="hsl(var(--foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="platné" fill="hsl(var(--status-valid))" />
                <Bar dataKey="brzy vyprší" fill="hsl(var(--status-warning))" />
                <Bar dataKey="prošlé" fill="hsl(var(--status-expired))" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>

        {/* Line Chart - Trendy aktivit */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Trendy školení (6 měsíců)</h3>
          </div>
          <ChartContainer config={{
            dokončeno: { label: "Dokončeno", color: "hsl(var(--chart-1))" },
            naplánováno: { label: "Naplánováno", color: "hsl(var(--chart-2))" }
          }} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="dokončeno" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="naplánováno" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>

        {/* Měsíční přehled odškolených hodin */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Měsíční přehled odškolených hodin</h3>
          <ChartContainer config={{
            hodiny: { label: "Hodiny", color: "hsl(var(--chart-1))" },
          }} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="měsíc" 
                  stroke="hsl(var(--foreground))"
                  fontSize={11}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="hodiny" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>

        {/* Trend počtu školení */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Trend počtu školení</h3>
          <ChartContainer config={{
            počet: { label: "Počet školení", color: "hsl(var(--chart-2))" },
          }} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="měsíc" 
                  stroke="hsl(var(--foreground))"
                  fontSize={11}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="počet" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>
      </div>

      {/* Statistiky podle typu školení */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Odškolené hodiny podle typu školení</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Typ školení</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Celkem hodin</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Počet školení</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Průměrná délka</th>
              </tr>
            </thead>
            <tbody>
              {trainingTypeStats.map((stat, index) => (
                <tr key={index} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                  <td className="py-3 px-4 font-medium">{stat.typ}</td>
                  <td className="py-3 px-4 text-right font-semibold text-primary">{stat.hodiny} h</td>
                  <td className="py-3 px-4 text-right">{stat.počet}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">{stat.prům_délka} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Statistiky školitelů */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Přehled školitelů</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Školitel</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Celkem školení</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Platná</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Prošlá</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Zaměstnanci</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Typy školení</th>
              </tr>
            </thead>
            <tbody>
              {trainerData.map((trainer, index) => (
                <tr key={index} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                  <td className="py-3 px-4 font-medium">{trainer.name}</td>
                  <td className="py-3 px-4 text-right font-semibold text-primary">{trainer.total}</td>
                  <td className="py-3 px-4 text-right text-status-valid">{trainer.valid}</td>
                  <td className="py-3 px-4 text-right text-status-expired">{trainer.expired}</td>
                  <td className="py-3 px-4 text-right">{trainer.employees}</td>
                  <td className="py-3 px-4 text-right text-muted-foreground">{trainer.types}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Email Delivery Statistics */}
      <div className="border-t pt-6">
        <EmailDeliveryStats />
      </div>
    </div>
  );
}