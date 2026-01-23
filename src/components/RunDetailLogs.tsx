import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmailPreviewDialog } from "@/components/EmailPreviewDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  CheckCircle2, 
  XCircle, 
  FlaskConical,
  Mail,
  User,
  GraduationCap,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface ReminderLogDetail {
  id: string;
  training_id: string | null;
  template_name: string;
  recipient_emails: string[];
  email_subject: string;
  email_body: string;
  sent_at: string;
  status: string;
  error_message: string | null;
  is_test: boolean;
  provider_used: string | null;
  trainings: {
    id: string;
    employees: {
      first_name: string;
      last_name: string;
    } | null;
    training_types: {
      name: string;
    } | null;
  } | null;
}

interface RunDetailLogsProps {
  runId: string;
  weekStart: string;
  isTest: boolean;
}

export function RunDetailLogs({ runId, weekStart, isTest }: RunDetailLogsProps) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ReminderLogDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [runId, weekStart, isTest]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      // Query logs for this run's week_start and is_test status
      const { data, error } = await supabase
        .from("reminder_logs")
        .select(`
          id,
          training_id,
          template_name,
          recipient_emails,
          email_subject,
          email_body,
          sent_at,
          status,
          error_message,
          is_test,
          provider_used,
          trainings (
            id,
            employees (first_name, last_name),
            training_types (name)
          )
        `)
        .eq("week_start", weekStart)
        .eq("is_test", isTest)
        .order("sent_at", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání detailů",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Žádné záznamy pro tento běh</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[50px]">Stav</TableHead>
            <TableHead>Zaměstnanec</TableHead>
            <TableHead>Typ školení</TableHead>
            <TableHead>Příjemci</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead className="text-right">Čas</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <div className="flex items-center gap-1">
                  {log.is_test && (
                    <FlaskConical className="w-3 h-3 text-muted-foreground" />
                  )}
                  {log.status === "sent" || log.status === "simulated" ? (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-muted-foreground" />
                  {log.trainings?.employees ? (
                    <span className="font-medium">
                      {log.trainings.employees.first_name} {log.trainings.employees.last_name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-3 h-3 text-muted-foreground" />
                  {log.trainings?.training_types ? (
                    <span>{log.trainings.training_types.name}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {log.recipient_emails.slice(0, 2).map((email, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs truncate max-w-[150px]">
                      {email}
                    </Badge>
                  ))}
                  {log.recipient_emails.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{log.recipient_emails.length - 2}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {log.provider_used ? (
                  <Badge variant="outline" className="text-xs">
                    {log.provider_used}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {format(new Date(log.sent_at), "HH:mm:ss", { locale: cs })}
              </TableCell>
              <TableCell>
                <EmailPreviewDialog log={log} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Error details section */}
      {logs.some(l => l.error_message) && (
        <div className="border-t p-4 bg-destructive/5">
          <p className="text-sm font-medium text-destructive mb-2">Chyby:</p>
          <div className="space-y-2">
            {logs.filter(l => l.error_message).map(log => (
              <div key={log.id} className="text-xs text-destructive">
                <span className="font-medium">
                  {log.trainings?.employees 
                    ? `${log.trainings.employees.first_name} ${log.trainings.employees.last_name}` 
                    : log.recipient_emails[0]}:
                </span>{" "}
                {log.error_message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}