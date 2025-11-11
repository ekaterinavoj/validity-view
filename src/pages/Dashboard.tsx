import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Training } from "@/types/training";
import { Calendar, CheckCircle, AlertCircle, XCircle, Upload } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { StatusBadge } from "@/components/StatusBadge";
import { useNavigate } from "react-router-dom";

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
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Výpočet statistik
  const totalTrainings = mockTrainings.length;
  const validTrainings = mockTrainings.filter(t => t.status === "valid").length;
  const warningTrainings = mockTrainings.filter(t => t.status === "warning").length;
  const expiredTrainings = mockTrainings.filter(t => t.status === "expired").length;

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

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>

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

      {/* Grafy */}
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
