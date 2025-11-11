import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Training } from "@/types/training";
import { Calendar, CheckCircle, XCircle, Upload, Activity, FileDown, FileSpreadsheet, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  // Export do Excel
  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const statsData = [
        ['Statistika', 'Hodnota'],
        ['Celkem školení', totalTrainings],
        ['Platné školení', validTrainings],
        ['Prošlé školení', expiredTrainings],
        ['Vyprší do 30 dní', expiring30],
        ['Vyprší do 60 dní', expiring60],
        ['Vyprší do 90 dní', expiring90],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(statsData);
      ws1['!cols'] = [{ wch: 25 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Statistiky');

      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `dashboard_statistiky_${timestamp}.xlsx`, { 
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
      pdf.text('Dashboard - Statistiky skoleni', pageWidth / 2, yPosition, { align: 'center' });
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
          ['Vyprsi do 60 dni', expiring60.toString()],
          ['Vyprsi do 90 dni', expiring90.toString()],
        ],
        theme: 'striped',
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: 15 },
      });

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
      </div>
    </div>
  );
}
