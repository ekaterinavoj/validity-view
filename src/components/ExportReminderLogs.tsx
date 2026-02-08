import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

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
  week_start: string | null;
  days_before: number | null;
  trainings: {
    id: string;
    next_training_date: string;
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
        week_start,
        days_before,
        trainings (
          id,
          next_training_date,
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
      "Týden od": log.week_start || "",
      "Datum odeslání": format(new Date(log.sent_at), "d. M. yyyy HH:mm:ss", { locale: cs }),
      "Stav": log.status === "sent" ? "Odesláno" : log.status === "simulated" ? "Simulováno" : "Chyba",
      "Test": log.is_test ? "Ano" : "Ne",
      "Šablona": log.template_name,
      "Zaměstnanec": log.trainings?.employees 
        ? `${log.trainings.employees.first_name} ${log.trainings.employees.last_name}` 
        : "",
      "Školení": log.trainings?.training_types?.name || "",
      "Vyprší": log.trainings?.next_training_date 
        ? format(new Date(log.trainings.next_training_date), "d. M. yyyy", { locale: cs })
        : "",
      "Dnů předem": log.days_before || "",
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
  return (
    <Button variant="outline" disabled={exporting} onClick={exportToCSV}>
      {exporting ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      Export CSV
    </Button>
  );
}