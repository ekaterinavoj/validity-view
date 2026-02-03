import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CheckCircle, XCircle, Clock, Activity, FileDown, FileSpreadsheet, TrendingUp, Users, AlertTriangle, Loader2 } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EmailDeliveryStats } from "@/components/EmailDeliveryStats";
import { useTrainings } from "@/hooks/useTrainings";
import { useTrainingTypes } from "@/hooks/useTrainingTypes";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
export default function Statistics() {
  const {
    toast
  } = useToast();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // Fetch real data from database
  const {
    trainings: activeTrainings,
    loading: trainingsLoading,
    error: trainingsError,
    refetch
  } = useTrainings(true);
  const {
    trainings: inactiveTrainings
  } = useTrainings(false);
  const {
    trainingTypes,
    loading: typesLoading
  } = useTrainingTypes();

  // Combine all trainings for complete statistics
  const allTrainings = useMemo(() => [...activeTrainings, ...inactiveTrainings], [activeTrainings, inactiveTrainings]);

  // Basic training statistics - computed from real data
  const totalTrainings = activeTrainings.length;
  const validTrainings = activeTrainings.filter(t => t.status === "valid").length;
  const warningTrainings = activeTrainings.filter(t => t.status === "warning").length;
  const expiredTrainings = activeTrainings.filter(t => t.status === "expired").length;
  const uniqueEmployees = new Set(activeTrainings.map(t => t.employeeNumber)).size;

  // Trainings expiring in next 30/60/90 days
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const expiring30 = useMemo(() => activeTrainings.filter(t => {
    const date = new Date(t.date);
    date.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length, [activeTrainings, today]);
  const expiring60 = useMemo(() => activeTrainings.filter(t => {
    const date = new Date(t.date);
    date.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 60;
  }).length, [activeTrainings, today]);
  const expiring90 = useMemo(() => activeTrainings.filter(t => {
    const date = new Date(t.date);
    date.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 90;
  }).length, [activeTrainings, today]);

  // Department statistics - computed from real data
  const departmentStats = useMemo(() => {
    return activeTrainings.reduce((acc, training) => {
      const dept = training.department || "Nezařazeno";
      if (!acc[dept]) {
        acc[dept] = {
          valid: 0,
          warning: 0,
          expired: 0
        };
      }
      acc[dept][training.status]++;
      return acc;
    }, {} as Record<string, {
      valid: number;
      warning: number;
      expired: number;
    }>);
  }, [activeTrainings]);
  const barData = useMemo(() => Object.entries(departmentStats).map(([dept, stats]) => ({
    department: dept || "Nezařazeno",
    platné: stats.valid,
    "brzy vyprší": stats.warning,
    prošlé: stats.expired
  })), [departmentStats]);

  // Facility statistics - computed from real data
  const facilityStats = useMemo(() => {
    return activeTrainings.reduce((acc, training) => {
      const facility = training.facility || "Nezařazeno";
      if (!acc[facility]) {
        acc[facility] = {
          valid: 0,
          warning: 0,
          expired: 0,
          total: 0
        };
      }
      acc[facility][training.status]++;
      acc[facility].total++;
      return acc;
    }, {} as Record<string, {
      valid: number;
      warning: number;
      expired: number;
      total: number;
    }>);
  }, [activeTrainings]);
  const facilityBarData = useMemo(() => Object.entries(facilityStats).map(([facility, stats]) => ({
    facility: facility || "Nezařazeno",
    platné: stats.valid,
    "brzy vyprší": stats.warning,
    prošlé: stats.expired,
    celkem: stats.total
  })).sort((a, b) => b.celkem - a.celkem), [facilityStats]);

  // Training type statistics - computed from real data
  const trainingTypeStats = useMemo(() => {
    const stats = activeTrainings.reduce((acc, training) => {
      const type = training.type || "Neznámý typ";
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          valid: 0,
          warning: 0,
          expired: 0,
          period: training.period
        };
      }
      acc[type].count++;
      acc[type][training.status]++;
      return acc;
    }, {} as Record<string, {
      count: number;
      valid: number;
      warning: number;
      expired: number;
      period: number;
    }>);
    return Object.entries(stats).map(([typ, data]) => ({
      typ,
      počet: data.count,
      platné: data.valid,
      varování: data.warning,
      prošlé: data.expired,
      periodicita: data.period
    })).sort((a, b) => b.počet - a.počet);
  }, [activeTrainings]);

  // Trainer statistics - computed from real data
  const trainerStats = useMemo(() => {
    return activeTrainings.reduce((acc, training) => {
      const trainer = training.trainer || "Neurčeno";
      if (!acc[trainer]) {
        acc[trainer] = {
          total: 0,
          valid: 0,
          warning: 0,
          expired: 0,
          employees: new Set<string>(),
          types: new Set<string>()
        };
      }
      acc[trainer].total++;
      acc[trainer][training.status]++;
      acc[trainer].employees.add(training.employeeNumber);
      acc[trainer].types.add(training.type);
      return acc;
    }, {} as Record<string, {
      total: number;
      valid: number;
      warning: number;
      expired: number;
      employees: Set<string>;
      types: Set<string>;
    }>);
  }, [activeTrainings]);
  const trainerData = useMemo(() => Object.entries(trainerStats).map(([name, stats]) => ({
    name,
    total: stats.total,
    valid: stats.valid,
    warning: stats.warning,
    expired: stats.expired,
    employees: stats.employees.size,
    types: stats.types.size
  })).filter(t => t.name !== "Neurčeno" || t.total > 0).sort((a, b) => b.total - a.total), [trainerStats]);

  // Monthly distribution - based on next_training_date
  const monthlyDistribution = useMemo(() => {
    const months = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];
    const distribution = months.map(m => ({
      měsíc: m,
      naplánováno: 0,
      prošlé: 0
    }));
    activeTrainings.forEach(training => {
      const date = new Date(training.date);
      const year = date.getFullYear().toString();
      if (year === selectedYear) {
        const monthIndex = date.getMonth();
        if (training.status === "expired") {
          distribution[monthIndex].prošlé++;
        } else {
          distribution[monthIndex].naplánováno++;
        }
      }
    });
    return distribution;
  }, [activeTrainings, selectedYear]);

  // Pie chart data for status distribution
  const statusPieData = useMemo(() => [{
    name: "Platné",
    value: validTrainings,
    color: "hsl(var(--status-valid))"
  }, {
    name: "Brzy vyprší",
    value: warningTrainings,
    color: "hsl(var(--status-warning))"
  }, {
    name: "Prošlé",
    value: expiredTrainings,
    color: "hsl(var(--status-expired))"
  }].filter(d => d.value > 0), [validTrainings, warningTrainings, expiredTrainings]);
  const chartConfig = {
    valid: {
      label: "Platné",
      color: "hsl(var(--status-valid))"
    },
    warning: {
      label: "Brzy vyprší",
      color: "hsl(var(--status-warning))"
    },
    expired: {
      label: "Prošlé",
      color: "hsl(var(--status-expired))"
    }
  };
  const currentYear = new Date().getFullYear();
  const years = Array.from({
    length: 5
  }, (_, i) => (currentYear - i).toString());

  // Export to Excel
  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Overall statistics
      const statsData = [['Statistika', 'Hodnota'], ['Celkem aktivnich skoleni', totalTrainings], ['Platne skoleni', validTrainings], ['Brzy vyprsi', warningTrainings], ['Prosle skoleni', expiredTrainings], ['Vyprsi do 30 dni', expiring30], ['Vyprsi do 60 dni', expiring60], ['Vyprsi do 90 dni', expiring90], ['Unikatni zamestnanci', uniqueEmployees]];
      const ws1 = XLSX.utils.aoa_to_sheet(statsData);
      ws1['!cols'] = [{
        wch: 25
      }, {
        wch: 15
      }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Statistiky');

      // Sheet 2: By department
      const deptData = [['Oddeleni', 'Platne', 'Brzy vyprsi', 'Prosle'], ...barData.map(d => [d.department, d.platné, d["brzy vyprší"], d.prošlé])];
      const ws2 = XLSX.utils.aoa_to_sheet(deptData);
      ws2['!cols'] = [{
        wch: 30
      }, {
        wch: 12
      }, {
        wch: 12
      }, {
        wch: 12
      }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Podle oddeleni');

      // Sheet 3: By training type
      const typeData = [['Typ skoleni', 'Pocet', 'Platne', 'Varovani', 'Prosle', 'Periodicita (dni)'], ...trainingTypeStats.map(d => [d.typ, d.počet, d.platné, d.varování, d.prošlé, d.periodicita])];
      const ws3 = XLSX.utils.aoa_to_sheet(typeData);
      ws3['!cols'] = [{
        wch: 30
      }, {
        wch: 10
      }, {
        wch: 10
      }, {
        wch: 10
      }, {
        wch: 10
      }, {
        wch: 15
      }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Podle typu');

      // Sheet 4: Trainers
      const trainerExportData = [['Skolitel', 'Celkem skoleni', 'Platne', 'Varovani', 'Prosle', 'Zamestnanci', 'Typy skoleni'], ...trainerData.map(d => [d.name, d.total, d.valid, d.warning, d.expired, d.employees, d.types])];
      const ws4 = XLSX.utils.aoa_to_sheet(trainerExportData);
      ws4['!cols'] = [{
        wch: 25
      }, {
        wch: 15
      }, {
        wch: 10
      }, {
        wch: 10
      }, {
        wch: 10
      }, {
        wch: 12
      }, {
        wch: 12
      }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Skolitele');
      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `statistiky_${timestamp}.xlsx`, {
        bookType: 'xlsx',
        type: 'binary'
      });
      toast({
        title: "Export dokončen",
        description: "Statistiky byly exportovány do Excel souboru."
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data do Excel.",
        variant: "destructive"
      });
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;
      pdf.setFontSize(20);
      pdf.text('Statistiky skoleni', pageWidth / 2, yPosition, {
        align: 'center'
      });
      yPosition += 10;
      pdf.setFontSize(10);
      const date = new Date().toLocaleDateString('cs-CZ');
      pdf.text(`Vygenerovano: ${date}`, pageWidth / 2, yPosition, {
        align: 'center'
      });
      yPosition += 15;
      pdf.setFontSize(14);
      pdf.text('Celkove statistiky', 15, yPosition);
      yPosition += 5;
      autoTable(pdf, {
        startY: yPosition,
        head: [['Statistika', 'Hodnota']],
        body: [['Celkem aktivnich skoleni', totalTrainings.toString()], ['Platne skoleni', validTrainings.toString()], ['Brzy vyprsi', warningTrainings.toString()], ['Prosle skoleni', expiredTrainings.toString()], ['Vyprsi do 30 dni', expiring30.toString()], ['Unikatni zamestnanci', uniqueEmployees.toString()]],
        theme: 'striped',
        headStyles: {
          fillColor: [66, 66, 66]
        },
        margin: {
          left: 15
        }
      });
      yPosition = (pdf as any).lastAutoTable.finalY + 15;
      pdf.setFontSize(14);
      pdf.text('Skoleni podle oddeleni', 15, yPosition);
      yPosition += 5;
      autoTable(pdf, {
        startY: yPosition,
        head: [['Oddeleni', 'Platne', 'Brzy vyprsi', 'Prosle']],
        body: barData.map(d => [d.department, d.platné.toString(), d["brzy vyprší"].toString(), d.prošlé.toString()]),
        theme: 'striped',
        headStyles: {
          fillColor: [66, 66, 66]
        },
        margin: {
          left: 15
        }
      });
      const timestamp = new Date().toISOString().split('T')[0];
      pdf.save(`statistiky_${timestamp}.pdf`);
      toast({
        title: "Export dokončen",
        description: "Statistiky byly exportovány do PDF souboru."
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat statistiky do PDF.",
        variant: "destructive"
      });
    }
  };

  // Loading state
  if (trainingsLoading || typesLoading) {
    return <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Statistika</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Načítám statistiky...</span>
        </div>
      </div>;
  }

  // Error state
  if (trainingsError) {
    return <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Statistika</h2>
        </div>
        <ErrorDisplay message={trainingsError} onRetry={refetch} />
      </div>;
  }
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Statistika</h2>
        <div className="flex gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToExcel} disabled={trainingsLoading || typesLoading || totalTrainings === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {trainingsLoading ? "Načítám..." : "Export do Excel"}
          </Button>
          <Button variant="outline" onClick={exportToPDF} disabled={trainingsLoading || typesLoading || totalTrainings === 0}>
            <FileDown className="w-4 h-4 mr-2" />
            {trainingsLoading ? "Načítám..." : "Export do PDF"}
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {totalTrainings === 0 && <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Žádná data k zobrazení</h3>
            <p className="text-muted-foreground">
              Zatím nejsou k dispozici žádná aktivní školení. Přidejte školení pro zobrazení statistik.
            </p>
          </div>
        </Card>}

      {/* Statistics cards */}
      {totalTrainings > 0 && <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Celkem aktivních školení</p>
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
                  <AlertTriangle className="w-6 h-6 text-status-warning" />
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
                <div className="p-3 bg-teal-500/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-teal-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Typy školení</p>
                  <p className="text-2xl font-bold">{trainingTypeStats.length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Bar Chart - By department */}
            {barData.length > 0 && <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Školení podle oddělení</h3>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="department" stroke="hsl(var(--foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--foreground))" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="platné" fill="hsl(var(--status-valid))" />
                      <Bar dataKey="brzy vyprší" fill="hsl(var(--status-warning))" />
                      <Bar dataKey="prošlé" fill="hsl(var(--status-expired))" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </Card>}

            {/* Pie Chart - Status distribution */}
            {statusPieData.length > 0 && <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Rozdělení podle stavu</h3>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusPieData} cx="50%" cy="50%" labelLine={false} label={({
                  name,
                  percent
                }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                        {statusPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </Card>}

            {/* Monthly distribution */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Měsíční přehled ({selectedYear})</h3>
              <ChartContainer config={{
            naplánováno: {
              label: "Aktivní",
              color: "hsl(var(--chart-1))"
            },
            prošlé: {
              label: "Prošlé",
              color: "hsl(var(--status-expired))"
            }
          }} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="měsíc" stroke="hsl(var(--foreground))" fontSize={11} angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="hsl(var(--foreground))" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="naplánováno" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="prošlé" fill="hsl(var(--status-expired))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </Card>

            {/* Training types trend */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Top typy školení</h3>
              <ChartContainer config={{
            počet: {
              label: "Počet školení",
              color: "hsl(var(--chart-2))"
            }
          }} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trainingTypeStats.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--foreground))" />
                    <YAxis dataKey="typ" type="category" stroke="hsl(var(--foreground))" fontSize={11} width={150} tickFormatter={value => value.length > 20 ? value.substring(0, 20) + '...' : value} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="počet" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </Card>
          </div>

          {/* Training types table */}
          {trainingTypeStats.length > 0 && <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Přehled podle typu školení</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Typ školení</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Celkem</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Platné</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Varování</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Prošlé</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Periodicita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingTypeStats.map((stat, index) => <tr key={index} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                        <td className="py-3 px-4 font-medium">{stat.typ}</td>
                        <td className="py-3 px-4 text-right font-semibold text-primary">{stat.počet}</td>
                        <td className="py-3 px-4 text-right text-status-valid">{stat.platné}</td>
                        <td className="py-3 px-4 text-right text-status-warning">{stat.varování}</td>
                        <td className="py-3 px-4 text-right text-status-expired">{stat.prošlé}</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{stat.periodicita} dní</td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </Card>}

          {/* Facility statistics table */}
          {facilityBarData.length > 0 && <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Přehled podle provozovny</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Provozovna</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Celkem</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Platné</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Varování</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Prošlé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facilityBarData.map((stat, index) => <tr key={index} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                        <td className="py-3 px-4 font-medium">{stat.facility}</td>
                        <td className="py-3 px-4 text-right font-semibold text-primary">{stat.celkem}</td>
                        <td className="py-3 px-4 text-right text-status-valid">{stat.platné}</td>
                        <td className="py-3 px-4 text-right text-status-warning">{stat["brzy vyprší"]}</td>
                        <td className="py-3 px-4 text-right text-status-expired">{stat.prošlé}</td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </Card>}

          {/* Trainers table */}
          {trainerData.length > 0 && trainerData.some(t => t.name !== "Neurčeno") && <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Přehled školitelů</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Školitel</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Celkem školení</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Platná</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Varování</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Prošlá</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Zaměstnanci</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Typy školení</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainerData.filter(t => t.name !== "Neurčeno").map((trainer, index) => <tr key={index} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                        <td className="py-3 px-4 font-medium">{trainer.name}</td>
                        <td className="py-3 px-4 text-right font-semibold text-primary">{trainer.total}</td>
                        <td className="py-3 px-4 text-right text-status-valid">{trainer.valid}</td>
                        <td className="py-3 px-4 text-right text-status-warning">{trainer.warning}</td>
                        <td className="py-3 px-4 text-right text-status-expired">{trainer.expired}</td>
                        <td className="py-3 px-4 text-right">{trainer.employees}</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{trainer.types}</td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </Card>}
        </>}

      {/* Email Delivery Statistics */}
      <div className="border-t pt-6">
        <EmailDeliveryStats />
      </div>
    </div>;
}