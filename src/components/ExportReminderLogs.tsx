import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import * as XLSX from "xlsx";

interface ReminderLogExport {
  id: string;
  template_name: string;
  recipient_emails: string[];
  email_subject: string;
  sent_at: string;
  status: string;
  error_message: string | null;
  is_test: boolean;
  provider_used: string | null;
  trainings: {
    employees: { first_name: string; last_name: string } | null;
    training_types: { name: string } | null;
  } | null;
}

export function ExportReminderLogs() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const fetchLogs = async (): Promise<ReminderLogExport[]> => {
    const { data, error } = await supabase
      .from("reminder_logs")
      .select(`
        id,
        template_name,
        recipient_emails,
        email_subject,
        sent_at,
        status,
        error_message,
        is_test,
        provider_used,
        trainings (
          employees (first_name, last_name),
          training_types (name)
        )
      `)
      .order("sent_at", { ascending: false })
      .limit(1000);

    if (error) throw error;
    return data || [];
  };

  const formatLogsForExport = (logs: ReminderLogExport[]) => {
    return logs.map(log => ({
      "ID": log.id,
      "Datum odeslání": format(new Date(log.sent_at), "d. M. yyyy HH:mm:ss", { locale: cs }),
      "Stav": log.status === "sent" ? "Odesláno" : log.status === "simulated" ? "Simulováno" : "Chyba",
      "Test": log.is_test ? "Ano" : "Ne",
      "Šablona": log.template_name,
      "Zaměstnanec": log.trainings?.employees 
        ? `${log.trainings.employees.first_name} ${log.trainings.employees.last_name}` 
        : "",
      "Školení": log.trainings?.training_types?.name || "",
      "Příjemci": log.recipient_emails.join(", "),
      "Předmět": log.email_subject,
      "Provider": log.provider_used || "",
      "Chyba": log.error_message || "",
    }));
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const logs = await fetchLogs();
      const data = formatLogsForExport(logs);

      // Create CSV content
      const headers = Object.keys(data[0] || {});
      const csvRows = [
        headers.join(";"),
        ...data.map(row => 
          headers.map(header => {
            const value = String(row[header as keyof typeof row] || "");
            // Escape quotes and wrap in quotes if contains special chars
            if (value.includes(";") || value.includes('"') || value.includes("\n")) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(";")
        )
      ];
      const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM for Excel

      // Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reminder-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export dokončen",
        description: `Exportováno ${logs.length} záznamů do CSV`,
      });
    } catch (error: any) {
      toast({
        title: "Chyba při exportu",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const logs = await fetchLogs();
      const data = formatLogsForExport(logs);

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);

      // Set column widths
      ws["!cols"] = [
        { wch: 36 },  // ID
        { wch: 20 },  // Datum
        { wch: 12 },  // Stav
        { wch: 6 },   // Test
        { wch: 20 },  // Šablona
        { wch: 25 },  // Zaměstnanec
        { wch: 25 },  // Školení
        { wch: 30 },  // Příjemci
        { wch: 40 },  // Předmět
        { wch: 12 },  // Provider
        { wch: 40 },  // Chyba
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Reminder Logs");

      // Download
      XLSX.writeFile(wb, `reminder-logs-${format(new Date(), "yyyy-MM-dd")}.xlsx`);

      toast({
        title: "Export dokončen",
        description: `Exportováno ${logs.length} záznamů do Excel`,
      });
    } catch (error: any) {
      toast({
        title: "Chyba při exportu",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exporting}>
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV}>
          <FileText className="w-4 h-4 mr-2" />
          Export do CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export do Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}