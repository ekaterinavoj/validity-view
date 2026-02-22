import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CheckCircle, XCircle, Clock, Activity, Download, TrendingUp, Users, AlertTriangle, Loader2, Timer, Copy, RefreshCw } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useRef } from "react";
import { exportToCSV } from "@/lib/csvExport";
import { EmailDeliveryStats } from "@/components/EmailDeliveryStats";
import { useTrainings } from "@/hooks/useTrainings";
import { useTrainingTypes } from "@/hooks/useTrainingTypes";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import html2canvas from "html2canvas";

export default function Statistics() {
  const {
    toast
  } = useToast();
  const [selectedYear, setSelectedYear] = useState("all");

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

  // Filter trainings by selected year (based on next_training_date)
  const yearFilteredTrainings = useMemo(() => {
    if (selectedYear === "all") return activeTrainings;
    return activeTrainings.filter(t => {
      const date = new Date(t.date);
      return date.getFullYear().toString() === selectedYear;
    });
  }, [activeTrainings, selectedYear]);

  // Basic training statistics - filtered by year
  const totalTrainings = yearFilteredTrainings.length;
  const validTrainings = yearFilteredTrainings.filter(t => t.status === "valid").length;
  const warningTrainings = yearFilteredTrainings.filter(t => t.status === "warning").length;
  const expiredTrainings = yearFilteredTrainings.filter(t => t.status === "expired").length;
  const uniqueEmployees = new Set(yearFilteredTrainings.map(t => t.employeeNumber)).size;

  // Trainings expiring in next 30/60/90 days (always current, not year filtered)
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

  // Department statistics - filtered by year
  const departmentStats = useMemo(() => {
    return yearFilteredTrainings.reduce((acc, training) => {
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
  }, [yearFilteredTrainings]);
  const barData = useMemo(() => Object.entries(departmentStats).map(([dept, stats]) => ({
    department: dept || "Nezařazeno",
    platné: stats.valid,
    "brzy vyprší": stats.warning,
    prošlé: stats.expired
  })), [departmentStats]);

  // Facility statistics - filtered by year
  const facilityStats = useMemo(() => {
    return yearFilteredTrainings.reduce((acc, training) => {
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
  }, [yearFilteredTrainings]);
  const facilityBarData = useMemo(() => Object.entries(facilityStats).map(([facility, stats]) => ({
    facility: facility || "Nezařazeno",
    platné: stats.valid,
    "brzy vyprší": stats.warning,
    prošlé: stats.expired,
    celkem: stats.total
  })).sort((a, b) => b.celkem - a.celkem), [facilityStats]);

  // Training type statistics - filtered by year
  const trainingTypeStats = useMemo(() => {
    const stats = yearFilteredTrainings.reduce((acc, training) => {
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
  }, [yearFilteredTrainings]);

  // Training hours statistics by year - unique sessions only
  // If multiple people attend the same training on the same day, it counts as ONE session
  const trainingHoursStats = useMemo(() => {
    // Create a map of training type id to duration hours
    const typeHoursMap = new Map<string, number>();
    trainingTypes.forEach(t => {
      typeHoursMap.set(t.id, t.durationHours || 1);
    });
    
    // Group trainings by year -> (date + type) to get unique sessions
    const yearStats: Record<number, {
      uniqueSessions: Set<string>; // Set of "date|typeId" keys
      sessionHours: Map<string, number>; // Map of session key to hours
      totalPeople: number;
    }> = {};
    
    allTrainings.forEach(training => {
      const trainingDate = new Date(training.lastTrainingDate);
      const year = trainingDate.getFullYear();
      
      if (!yearStats[year]) {
        yearStats[year] = {
          uniqueSessions: new Set(),
          sessionHours: new Map(),
          totalPeople: 0
        };
      }
      
      // Create unique session key: date + training type
      const sessionKey = `${training.lastTrainingDate}|${training.trainingTypeId}`;
      const hours = typeHoursMap.get(training.trainingTypeId) || 1;
      
      yearStats[year].uniqueSessions.add(sessionKey);
      yearStats[year].sessionHours.set(sessionKey, hours);
      yearStats[year].totalPeople++;
    });
    
    // Calculate totals per year
    return Object.entries(yearStats)
      .map(([year, stats]) => {
        let totalHours = 0;
        stats.sessionHours.forEach(hours => {
          totalHours += hours;
        });
        
        return {
          year: parseInt(year),
          sessions: stats.uniqueSessions.size,
          hours: totalHours,
          people: stats.totalPeople
        };
      })
      .sort((a, b) => b.year - a.year); // Sort by year descending
  }, [allTrainings, trainingTypes]);

  // Trainer statistics - filtered by year
  const trainerStats = useMemo(() => {
    return yearFilteredTrainings.reduce((acc, training) => {
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
  }, [yearFilteredTrainings]);
  const trainerData = useMemo(() => Object.entries(trainerStats).map(([name, stats]) => ({
    name,
    total: stats.total,
    valid: stats.valid,
    warning: stats.warning,
    expired: stats.expired,
    employees: stats.employees.size,
    types: stats.types.size
  })).filter(t => t.name !== "Neurčeno" || t.total > 0).sort((a, b) => b.total - a.total), [trainerStats]);

  // Monthly distribution - based on next_training_date (already filtered by year)
  const monthlyDistribution = useMemo(() => {
    const months = ["Led", "Úno", "Bře", "Dub", "Kvě", "Čvn", "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"];
    const distribution = months.map(m => ({
      měsíc: m,
      aktivní: 0,
      prošlé: 0
    }));
    yearFilteredTrainings.forEach(training => {
      const date = new Date(training.date);
      const monthIndex = date.getMonth();
      if (training.status === "expired") {
        distribution[monthIndex].prošlé++;
      } else {
        distribution[monthIndex].aktivní++;
      }
    });
    return distribution;
  }, [yearFilteredTrainings]);

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
  // Dynamic year list from actual data
  const years = useMemo(() => {
    const yearSet = new Set<string>();
    allTrainings.forEach(t => {
      if (t.date) yearSet.add(new Date(t.date).getFullYear().toString());
      if (t.lastTrainingDate) yearSet.add(new Date(t.lastTrainingDate).getFullYear().toString());
    });
    const sorted = Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
    return ["all", ...sorted];
  }, [allTrainings]);

  // Chart refs for copying
  const departmentChartRef = useRef<HTMLDivElement>(null);
  const statusPieChartRef = useRef<HTMLDivElement>(null);
  const monthlyChartRef = useRef<HTMLDivElement>(null);
  const topTypesChartRef = useRef<HTMLDivElement>(null);

  // Copy chart as image
  const copyChartAsImage = async (chartRef: React.RefObject<HTMLDivElement>, chartName: string) => {
    if (!chartRef.current) return;
    
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            toast({
              title: "Graf zkopírován",
              description: `Graf "${chartName}" byl zkopírován do schránky jako obrázek.`,
            });
          } catch (err) {
            // Fallback: download the image
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${chartName.replace(/\s+/g, '_').toLowerCase()}.png`;
            link.click();
            URL.revokeObjectURL(url);
            toast({
              title: "Graf stažen",
              description: `Graf "${chartName}" byl stažen jako obrázek (kopírování do schránky není podporováno).`,
            });
          }
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error copying chart:', error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se zkopírovat graf.",
        variant: "destructive",
      });
    }
  };

  // Export CSV with multiple datasets
  const handleExportCSV = () => {
    try {
      // Training hours data
      const hoursData = trainingHoursStats.map(stat => ({
        "Rok": stat.year,
        "Unikátních školení": stat.sessions,
        "Celkem hodin": stat.hours.toFixed(1),
        "Proškolených osob": stat.people
      }));

      // Training types data
      const typesData = trainingTypeStats.map(d => ({
        "Typ školení": d.typ,
        "Počet": d.počet,
        "Platné": d.platné,
        "Varování": d.varování,
        "Prošlé": d.prošlé,
        "Periodicita (dní)": d.periodicita
      }));

      // Trainer data
      const trainersData = trainerData.filter(t => t.name !== "Neurčeno").map(t => ({
        "Školitel": t.name,
        "Celkem školení": t.total,
        "Platná": t.valid,
        "Varování": t.warning,
        "Prošlá": t.expired,
        "Zaměstnanců": t.employees,
        "Typů školení": t.types
      }));

      // Facility data
      const facilityData = facilityBarData.map(f => ({
        "Provozovna": f.facility,
        "Celkem": f.celkem,
        "Platné": f.platné,
        "Brzy vyprší": f["brzy vyprší"],
        "Prošlé": f.prošlé
      }));

      // Combine all into one export with sections
      const allData: Record<string, string | number>[] = [];
      
      allData.push({ "SEKCE": "ODŠKOLENÉ HODINY" });
      hoursData.forEach(row => allData.push(row));
      allData.push({});
      
      allData.push({ "SEKCE": "TYPY ŠKOLENÍ" });
      typesData.forEach(row => allData.push(row));
      allData.push({});
      
      allData.push({ "SEKCE": "PŘEHLED ŠKOLITELŮ" });
      trainersData.forEach(row => allData.push(row));
      allData.push({});
      
      allData.push({ "SEKCE": "PROVOZOVNY" });
      facilityData.forEach(row => allData.push(row));

      const timestamp = new Date().toISOString().split('T')[0];
      exportToCSV({
        filename: `statistiky_${timestamp}.csv`,
        data: allData,
      });

      toast({
        title: "Export dokončen",
        description: "Statistiky byly exportovány do CSV souboru.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data do CSV.",
        variant: "destructive",
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
          <Button variant="outline" size="icon" onClick={refetch} disabled={trainingsLoading || typesLoading} title="Obnovit data">
            <RefreshCw className={`w-4 h-4 ${trainingsLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => <SelectItem key={year} value={year}>{year === "all" ? "Všechny roky" : year}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV} disabled={trainingsLoading || typesLoading || totalTrainings === 0}>
            <Download className="w-4 h-4 mr-2" />
            {trainingsLoading ? "Načítám..." : "Export CSV"}
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

          {/* Training Hours Statistics Table */}
          {trainingHoursStats.length > 0 && <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Timer className="w-5 h-5 text-primary" />
                Odškolené hodiny podle roků
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Statistika unikátních školení - pokud více lidí absolvuje stejné školení ve stejný den, počítá se jako jedno školení.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Rok</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Unikátních školení</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Celkem hodin</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Proškolených osob</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingHoursStats.map((stat, index) => <tr key={index} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-foreground">{stat.year}</td>
                        <td className="py-3 px-4 text-right font-semibold text-primary">{stat.sessions}</td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">{stat.hours.toFixed(1)} h</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{stat.people}</td>
                      </tr>)}
                    {/* Total row */}
                    <tr className="border-t-2 border-border bg-muted/50">
                      <td className="py-3 px-4 font-bold text-foreground">Celkem</td>
                      <td className="py-3 px-4 text-right font-bold text-primary">
                        {trainingHoursStats.reduce((sum, s) => sum + s.sessions, 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {trainingHoursStats.reduce((sum, s) => sum + s.hours, 0).toFixed(1)} h
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-muted-foreground">
                        {trainingHoursStats.reduce((sum, s) => sum + s.people, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>}

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Bar Chart - By department */}
            {barData.length > 0 && <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Školení podle oddělení ({selectedYear})</h3>
                    <p className="text-sm text-muted-foreground">Počet školení v kusech (ks)</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyChartAsImage(departmentChartRef, "Školení podle oddělení")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div ref={departmentChartRef}>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="department" stroke="hsl(var(--foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--foreground))" label={{ value: 'Počet (ks)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' } }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="platné" name="Platné (ks)" fill="hsl(var(--status-valid))" />
                        <Bar dataKey="brzy vyprší" name="Brzy vyprší (ks)" fill="hsl(var(--status-warning))" />
                        <Bar dataKey="prošlé" name="Prošlé (ks)" fill="hsl(var(--status-expired))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </Card>}

            {/* Pie Chart - Status distribution */}
            {statusPieData.length > 0 && <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Rozdělení podle stavu ({selectedYear})</h3>
                    <p className="text-sm text-muted-foreground">Procentuální podíl stavů školení</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyChartAsImage(statusPieChartRef, "Rozdělení podle stavu")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div ref={statusPieChartRef}>
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusPieData} cx="50%" cy="50%" labelLine={false} label={({
                    name,
                    percent,
                    value
                  }) => `${name}: ${value} ks (${(percent * 100).toFixed(0)}%)`} outerRadius={100} fill="#8884d8" dataKey="value">
                          {statusPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </Card>}

            {/* Monthly distribution */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Měsíční přehled ({selectedYear})</h3>
                <Button variant="ghost" size="sm" onClick={() => copyChartAsImage(monthlyChartRef, `Měsíční přehled ${selectedYear}`)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div ref={monthlyChartRef}>
                <ChartContainer config={{
              aktivní: {
                label: "Aktivní školení (ks)",
                color: "hsl(var(--chart-1))"
              },
              prošlé: {
                label: "Prošlá školení (ks)",
                color: "hsl(var(--status-expired))"
              }
            }} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="měsíc" stroke="hsl(var(--foreground))" fontSize={11} angle={-45} textAnchor="end" height={80} />
                      <YAxis stroke="hsl(var(--foreground))" label={{ value: 'Počet školení', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))' } }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="aktivní" name="Aktivní (ks)" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="prošlé" name="Prošlé (ks)" fill="hsl(var(--status-expired))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </Card>

            {/* Training types trend */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Top typy školení ({selectedYear})</h3>
                  <p className="text-sm text-muted-foreground">Počet školení v kusech (ks)</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copyChartAsImage(topTypesChartRef, "Top typy školení")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div ref={topTypesChartRef}>
                <ChartContainer config={{
              počet: {
                label: "Počet školení (ks)",
                color: "hsl(var(--chart-2))"
              }
            }} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trainingTypeStats.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--foreground))" label={{ value: 'Počet (ks)', position: 'bottom', style: { fill: 'hsl(var(--muted-foreground))' } }} />
                      <YAxis dataKey="typ" type="category" stroke="hsl(var(--foreground))" fontSize={11} width={150} tickFormatter={value => value.length > 20 ? value.substring(0, 20) + '...' : value} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="počet" name="Počet (ks)" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </Card>
          </div>

          {/* Training types table */}
          {trainingTypeStats.length > 0 && <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Přehled podle typu školení ({selectedYear})</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Typ školení</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Celkem (ks)</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Platné (ks)</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Varování (ks)</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Prošlé (ks)</th>
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
              <h3 className="text-lg font-semibold mb-4">Přehled podle provozovny ({selectedYear})</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Provozovna</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Celkem (ks)</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Platné (ks)</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Varování (ks)</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Prošlé (ks)</th>
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
              <h3 className="text-lg font-semibold mb-4">Přehled školitelů ({selectedYear})</h3>
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