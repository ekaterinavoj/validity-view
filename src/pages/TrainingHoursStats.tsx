import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from "recharts";
import { Calendar, Clock, TrendingUp, FileSpreadsheet, FileDown } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TrainingHoursStats() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState("all");
  const { toast } = useToast();

  // Mock data - později nahradíme reálnými daty z databáze
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  
  const months = [
    { value: "all", label: "Celý rok" },
    { value: "1", label: "Leden" },
    { value: "2", label: "Únor" },
    { value: "3", label: "Březen" },
    { value: "4", label: "Duben" },
    { value: "5", label: "Květen" },
    { value: "6", label: "Červen" },
    { value: "7", label: "Červenec" },
    { value: "8", label: "Srpen" },
    { value: "9", label: "Září" },
    { value: "10", label: "Říjen" },
    { value: "11", label: "Listopad" },
    { value: "12", label: "Prosinec" },
  ];

  // Simulovaná data pro statistiky
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

  const departmentStats = [
    { oddělení: "Výroba", hodiny: 248, počet: 89 },
    { oddělení: "Údržba", hodiny: 156, počet: 42 },
    { oddělení: "Logistika", hodiny: 98, počet: 28 },
    { oddělení: "Administrativa", hodiny: 64, počet: 19 },
  ];

  const totalHours = monthlyData.reduce((sum, item) => sum + item.hodiny, 0);
  const totalTrainings = monthlyData.reduce((sum, item) => sum + item.počet, 0);
  const avgHoursPerTraining = (totalHours / totalTrainings).toFixed(1);
  const avgHoursPerMonth = (totalHours / 12).toFixed(1);

  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // List 1: Celkové statistiky
      const statsData = [
        ['Statistika', 'Hodnota'],
        ['Rok', selectedYear],
        ['Celkem hodin', totalHours],
        ['Celkem skoleni', totalTrainings],
        ['Prumer hodin na skoleni', avgHoursPerTraining],
        ['Prumer hodin za mesic', avgHoursPerMonth],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(statsData);
      ws1['!cols'] = [{ wch: 30 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Statistiky');

      // List 2: Měsíční přehled
      const monthlyExportData = [
        ['Mesic', 'Hodiny', 'Pocet skoleni'],
        ...monthlyData.map(d => [d.měsíc, d.hodiny, d.počet])
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(monthlyExportData);
      ws2['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Mesicni prehled');

      // List 3: Podle typu školení
      const typeData = [
        ['Typ skoleni', 'Hodiny', 'Pocet skoleni', 'Prumerna delka'],
        ...trainingTypeStats.map(d => [d.typ, d.hodiny, d.počet, d.prům_délka])
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(typeData);
      ws3['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Podle typu');

      // List 4: Podle oddělení
      const deptData = [
        ['Oddeleni', 'Hodiny', 'Pocet skoleni'],
        ...departmentStats.map(d => [d.oddělení, d.hodiny, d.počet])
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(deptData);
      ws4['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Podle oddeleni');

      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `odskolene_hodiny_${selectedYear}_${timestamp}.xlsx`, {
        bookType: 'xlsx',
        type: 'binary'
      });

      toast({
        title: "Export dokončen",
        description: "Statistiky odškolených hodin byly exportovány do Excel souboru.",
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
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;

      // Nadpis
      pdf.setFontSize(20);
      pdf.text('Statistiky odskolenich hodin', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Období
      pdf.setFontSize(12);
      const period = selectedMonth === "all" 
        ? `Rok ${selectedYear}` 
        : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;
      pdf.text(period, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Celkové statistiky
      pdf.setFontSize(14);
      pdf.text('Celkove statistiky', 15, yPosition);
      yPosition += 5;

      autoTable(pdf, {
        startY: yPosition,
        head: [['Statistika', 'Hodnota']],
        body: [
          ['Celkem hodin', totalHours.toString()],
          ['Celkem skoleni', totalTrainings.toString()],
          ['Prumer hodin na skoleni', avgHoursPerTraining],
          ['Prumer hodin za mesic', avgHoursPerMonth],
        ],
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: 15 },
      });

      yPosition = (pdf as any).lastAutoTable.finalY + 15;

      // Podle typu školení
      pdf.setFontSize(14);
      pdf.text('Podle typu skoleni', 15, yPosition);
      yPosition += 5;

      autoTable(pdf, {
        startY: yPosition,
        head: [['Typ skoleni', 'Hodiny', 'Pocet', 'Prumer']],
        body: trainingTypeStats.map(d => [
          d.typ,
          d.hodiny.toString(),
          d.počet.toString(),
          d.prům_délka.toString()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: 15 },
      });

      yPosition = (pdf as any).lastAutoTable.finalY + 15;

      // Podle oddělení
      pdf.setFontSize(14);
      pdf.text('Podle oddeleni', 15, yPosition);
      yPosition += 5;

      autoTable(pdf, {
        startY: yPosition,
        head: [['Oddeleni', 'Hodiny', 'Pocet skoleni']],
        body: departmentStats.map(d => [
          d.oddělení,
          d.hodiny.toString(),
          d.počet.toString()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: 15 },
      });

      yPosition = (pdf as any).lastAutoTable.finalY + 15;

      // Měsíční přehled (pokud je vybrán celý rok)
      if (selectedMonth === "all" && yPosition < 200) {
        pdf.setFontSize(14);
        pdf.text('Mesicni prehled', 15, yPosition);
        yPosition += 5;

        autoTable(pdf, {
          startY: yPosition,
          head: [['Mesic', 'Hodiny', 'Pocet skoleni']],
          body: monthlyData.map(d => [
            d.měsíc,
            d.hodiny.toString(),
            d.počet.toString()
          ]),
          theme: 'striped',
          headStyles: { fillColor: [66, 66, 66] },
          margin: { left: 15 },
        });
      }

      const timestamp = new Date().toISOString().split('T')[0];
      pdf.save(`odskolene_hodiny_${selectedYear}_${timestamp}.pdf`);

      toast({
        title: "Export dokončen",
        description: "Statistiky hodin byly exportovány do PDF souboru.",
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
        <h2 className="text-3xl font-bold text-foreground">Statistiky odškolených hodin</h2>
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

      {/* Filtry */}
      <Card className="p-6">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">Filtrovat:</span>
          </div>
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
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Celkové statistiky */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Celkem hodin</p>
              <p className="text-2xl font-bold">{totalHours}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Celkem školení</p>
              <p className="text-2xl font-bold">{totalTrainings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Průměr hodin/školení</p>
              <p className="text-2xl font-bold">{avgHoursPerTraining}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <Clock className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Průměr hodin/měsíc</p>
              <p className="text-2xl font-bold">{avgHoursPerMonth}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Grafy */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Měsíční přehled */}
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

      {/* Statistiky podle oddělení */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Odškolené hodiny podle oddělení</h3>
        <ChartContainer config={{
          hodiny: { label: "Hodiny", color: "hsl(var(--chart-3))" },
        }} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={departmentStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--foreground))" />
              <YAxis 
                type="category" 
                dataKey="oddělení" 
                stroke="hsl(var(--foreground))"
                width={120}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="hodiny" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </Card>
    </div>
  );
}