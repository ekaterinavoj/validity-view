import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Mail, Users, CheckCircle2, XCircle, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface ReminderLog {
  id: string;
  training_id: string | null;
  template_id: string | null;
  template_name: string;
  recipient_emails: string[] | null;
  email_subject: string;
  email_body: string;
  sent_at: string | null;
  status: string;
  error_message: string | null;
  run_id: string | null;
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

export const ReminderLogs = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("reminder_logs")
        .select(`
          id,
          training_id,
          template_id,
          template_name,
          recipient_emails,
          email_subject,
          email_body,
          sent_at,
          status,
          error_message,
          run_id,
          trainings (
            id,
            employees (first_name, last_name),
            training_types (name)
          )
        `)
        .order("sent_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání logů",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const emails = log.recipient_emails ?? [];
    const matchesSearch =
      log.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.email_subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emails.some((email) =>
        email.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesStatus =
      statusFilter === "all" || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Načítání logů...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Přehled odeslaných připomínek
              </CardTitle>
              <CardDescription>
                Historie automaticky odeslaných emailových připomínek školení
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Hledat podle šablony, předmětu nebo emailu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrovat stav" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny</SelectItem>
                <SelectItem value="sent">Odeslané</SelectItem>
                <SelectItem value="failed">Chyby</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchTerm || statusFilter !== "all"
                  ? "Nenalezeny žádné záznamy odpovídající filtrům."
                  : "Zatím nebyly odeslány žádné připomínky."}
              </p>
            ) : (
              filteredLogs.map((log) => {
                const emails = log.recipient_emails ?? [];
                return (
                  <Card key={log.id} className="border-l-4 border-l-primary/50">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">{log.template_name}</h3>
                              {log.status === "sent" ? (
                                <Badge variant="default" className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Odesláno
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <XCircle className="w-3 h-3" />
                                  Chyba
                                </Badge>
                              )}
                            </div>
                            
                            {log.trainings && (
                              <p className="text-sm text-muted-foreground mb-2">
                                Školení: <span className="font-medium">{log.trainings.training_types?.name}</span>
                                {" - "}
                                Zaměstnanec: <span className="font-medium">
                                  {log.trainings.employees?.first_name} {log.trainings.employees?.last_name}
                                </span>
                              </p>
                            )}

                            <div className="flex flex-wrap gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span>
                                  {log.sent_at
                                    ? format(new Date(log.sent_at), "d. MMMM yyyy 'v' HH:mm", { locale: cs })
                                    : "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span>{emails.length} příjemců</span>
                              </div>
                            </div>

                            <div className="mt-3 p-3 bg-muted/50 rounded-md">
                              <p className="text-xs font-semibold text-muted-foreground mb-1">
                                Předmět emailu:
                              </p>
                              <p className="text-sm">{log.email_subject}</p>
                            </div>

                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground">
                                Příjemci: {emails.join(", ") || "—"}
                              </p>
                            </div>

                            {log.error_message && (
                              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                <p className="text-xs font-semibold text-destructive mb-1">
                                  Chybová zpráva:
                                </p>
                                <p className="text-sm text-destructive">{log.error_message}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
