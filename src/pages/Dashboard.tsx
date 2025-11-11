import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Training } from "@/types/training";
import { Calendar, CheckCircle, AlertCircle, XCircle, Upload, TrendingUp, Users, Clock, Activity, FileDown, FileSpreadsheet } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, Area, AreaChart } from "recharts";
import { StatusBadge } from "@/components/StatusBadge";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

// Mock data - stejná jako v ScheduledTrainings
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Filtrovat pouze aktivní školení
  const activeTrainings = mockTrainings.filter(t => t.is_active !== false);
  
  // Výpočet statistik (pouze z aktivních školení)
  const totalTrainings = activeTrainings.length;
  const validTrainings = activeTrainings.filter(t => t.status === "valid").length;
  const warningTrainings = activeTrainings.filter(t => t.status === "warning").length;
  const expiredTrainings = activeTrainings.filter(t => t.status === "expired").length;
  
  // Statistiky o zaměstnancích
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
  
  // Mock data pro trendy - simulace školení v posledních 6 měsících
  const trendData = [
    { month: "Červen", dokončeno: 12, naplánováno: 8 },
    { month: "Červenec", dokončeno: 15, naplánováno: 10 },
    { month: "Srpen", dokončeno: 8, naplánováno: 6 },
    { month: "Září", dokončeno: 18, naplánováno: 12 },
    { month: "Říjen", dokončeno: 14, naplánováno: 9 },
    { month: "Listopad", dokončeno: 20, naplánováno: 15 },
  ];
  
  // Data pro expirující certifikáty timeline
  const expirationTimeline = [
    { období: "0-30 dní", počet: expiring30 },
    { období: "31-60 dní", počet: expiring60 - expiring30 },
    { období: "61-90 dní", počet: expiring90 - expiring60 },
  ];

  // Data pro pie chart
  const pieData = [
    { name: "Platné", value: validTrainings, fill: "hsl(var(--status-valid))" },
    { name: "Brzy vyprší", value: warningTrainings, fill: "hsl(var(--status-warning))" },
    { name: "Prošlé", value: expiredTrainings, fill: "hsl(var(--status-expired))" },
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

  // Nadcházející školení (seřazeno podle data)
  const upcomingTrainings = [...mockTrainings]
    .filter(t => new Date(t.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

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
      // Pracovní sešit
      const wb = XLSX.utils.book_new();

      // List 1: Celkové statistiky
      const statsData = [
        ['Statistika', 'Hodnota'],
        ['Celkem školení', totalTrainings],
        ['Platné školení', validTrainings],
        ['Brzy vyprší', warningTrainings],
        ['Prošlé školení', expiredTrainings],
        ['Školení zaměstnanců', uniqueEmployees],
        ['Vyprší do 30 dní', expiring30],
        ['Vyprší do 60 dní', expiring60],
        ['Vyprší do 90 dní', expiring90],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Statistiky');

      // List 2: Školení podle oddělení
      const deptData = [
        ['Oddělení', 'Platné', 'Brzy vyprší', 'Prošlé'],
        ...barData.map(d => [d.department, d.platné, d['brzy vyprší'], d.prošlé])
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(deptData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Podle oddělení');

      // List 3: Trendy
      const trendExportData = [
        ['Měsíc', 'Dokončeno', 'Naplánováno'],
        ...trendData.map(d => [d.month, d.dokončeno, d.naplánováno])
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(trendExportData);
      XLSX.utils.book_append_sheet(wb, ws3, 'Trendy');

      // List 4: Expirující certifikáty
      const expirationData = [
        ['Období', 'Počet'],
        ...expirationTimeline.map(d => [d.období, d.počet])
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(expirationData);
      XLSX.utils.book_append_sheet(wb, ws4, 'Expirující');

      // Uložení souboru
      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `dashboard_statistiky_${timestamp}.xlsx`);

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
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // Nadpis
      pdf.setFontSize(20);
      pdf.text('Dashboard - Statistiky školení', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Datum generování
      pdf.setFontSize(10);
      const date = new Date().toLocaleDateString('cs-CZ');
      pdf.text(`Vygenerováno: ${date}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Statistiky - tabulka
      pdf.setFontSize(14);
      pdf.text('Celkové statistiky', 15, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      const stats = [
        ['Celkem školení:', totalTrainings.toString()],
        ['Platné školení:', validTrainings.toString()],
        ['Brzy vyprší:', warningTrainings.toString()],
        ['Prošlé školení:', expiredTrainings.toString()],
        ['Školení zaměstnanců:', uniqueEmployees.toString()],
        ['Vyprší do 30 dní:', expiring30.toString()],
        ['Vyprší do 60 dní:', expiring60.toString()],
        ['Vyprší do 90 dní:', expiring90.toString()],
      ];

      stats.forEach(([label, value]) => {
        pdf.text(label, 20, yPosition);
        pdf.text(value, 80, yPosition);
        yPosition += 7;
      });

      yPosition += 10;

      // Školení podle oddělení
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(14);
      pdf.text('Školení podle oddělení', 15, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      barData.forEach(dept => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(`${dept.department}:`, 20, yPosition);
        pdf.text(`Platné: ${dept.platné}, Brzy vyprší: ${dept['brzy vyprší']}, Prošlé: ${dept.prošlé}`, 25, yPosition + 5);
        yPosition += 12;
      });

      // Uložení PDF
      const timestamp = new Date().toISOString().split('T')[0];
      pdf.save(`dashboard_${timestamp}.pdf`);

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
        <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
        <div className="flex gap-2">
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

      {/* Hromadný import */}
      <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Hromadný import školení</h3>
              <p className="text-sm text-muted-foreground">
                Importujte školení z Excel nebo CSV souboru
              </p>
            </div>
          </div>
          <Button 
            onClick={() => navigate('/bulk-import')}
            size="lg"
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Otevřít import
          </Button>
        </div>
      </Card>

      {/* Statistiky - řádek 1 */}
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
              <p className="text-sm text-muted-foreground">Prošlé školení</p>
              <p className="text-2xl font-bold">{expiredTrainings}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Statistiky - řádek 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Školení zaměstnanců</p>
              <p className="text-2xl font-bold">{uniqueEmployees}</p>
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
      </div>

      {/* Grafy - řádek 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pie Chart - Celkový přehled */}
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
      </div>

      {/* Grafy - řádek 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
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

        {/* Area Chart - Expirující certifikáty timeline */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold">Expirující certifikáty (90 dní)</h3>
          </div>
          <ChartContainer config={{
            počet: { label: "Počet školení", color: "hsl(var(--chart-3))" }
          }} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={expirationTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="období" 
                  stroke="hsl(var(--foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area 
                  type="monotone" 
                  dataKey="počet" 
                  stroke="hsl(var(--chart-3))" 
                  fill="hsl(var(--chart-3))"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </Card>
      </div>

      {/* Nadcházející školení */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Nadcházející školení</h3>
        <div className="space-y-4">
          {upcomingTrainings.length > 0 ? (
            upcomingTrainings.map((training) => (
              <div
                key={training.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <StatusBadge status={training.status} />
                  <div className="flex-1">
                    <p className="font-medium">{training.employeeName}</p>
                    <p className="text-sm text-muted-foreground">{training.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {new Date(training.date).toLocaleDateString("cs-CZ")}
                    </p>
                    <p className="text-sm text-muted-foreground">{training.department}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Žádná nadcházející školení
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
