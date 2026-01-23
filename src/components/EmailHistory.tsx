import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  History, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  Clock,
  Users,
  RefreshCw,
  FlaskConical,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface ReminderLogEntry {
  id: string;
  sent_at: string;
  status: string;
  recipient_emails: string[];
  email_subject: string;
  email_body: string;
  template_name: string;
  provider_used: string | null;
  is_test: boolean;
  error_message: string | null;
  week_start: string | null;
}

export function EmailHistory() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<ReminderLogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [previewLog, setPreviewLog] = useState<ReminderLogEntry | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reminder_logs")
        .select("id, sent_at, status, recipient_emails, email_subject, email_body, template_name, provider_used, is_test, error_message, week_start")
        .order("sent_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání historie",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const toggleLogExpanded = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-primary/20 text-primary"><CheckCircle2 className="w-3 h-3 mr-1" />Odesláno</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Chyba</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <History className="w-4 h-4 mr-2" />
            Historie odeslaných emailů
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Historie odeslaných emailů
            </DialogTitle>
            <DialogDescription>
              Přehled všech odeslaných souhrnných emailů s připomínkami školení
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Obnovit
            </Button>
          </div>

          <ScrollArea className="flex-1 pr-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Zatím nebyly odeslány žádné emaily</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => {
                  const isExpanded = expandedLogs.has(log.id);
                  
                  return (
                    <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleLogExpanded(log.id)}>
                      <div className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-start justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                                <span className="font-medium text-sm">
                                  {format(new Date(log.sent_at), "d. M. yyyy HH:mm", { locale: cs })}
                                </span>
                                {getStatusBadge(log.status)}
                                {log.is_test && (
                                  <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                    <FlaskConical className="w-3 h-3" />
                                    Test
                                  </Badge>
                                )}
                                {log.provider_used && (
                                  <Badge variant="secondary" className="text-xs">
                                    {log.provider_used}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground ml-6">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {log.recipient_emails?.length || 0} příjemců
                                </span>
                                {log.week_start && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Období: {log.week_start}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewLog(log);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t bg-muted/30 p-3 space-y-3">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Předmět:</p>
                              <p className="text-sm">{log.email_subject}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Příjemci:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {log.recipient_emails?.map((email, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {email}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {log.error_message && (
                              <div className="p-2 bg-destructive/10 border border-destructive/30 rounded-md">
                                <p className="text-sm text-destructive">{log.error_message}</p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Email Preview Dialog */}
      <Dialog open={!!previewLog} onOpenChange={(open) => !open && setPreviewLog(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Náhled emailu
            </DialogTitle>
            <DialogDescription>
              {previewLog && format(new Date(previewLog.sent_at), "d. MMMM yyyy HH:mm", { locale: cs })}
            </DialogDescription>
          </DialogHeader>
          
          {previewLog && (
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Předmět</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{previewLog.email_subject}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Příjemci</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {previewLog.recipient_emails?.map((email, idx) => (
                        <Badge key={idx} variant="secondary">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Obsah emailu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose prose-sm max-w-none p-4 bg-white rounded-md border"
                      dangerouslySetInnerHTML={{ __html: previewLog.email_body }}
                    />
                  </CardContent>
                </Card>

                {previewLog.error_message && (
                  <Card className="border-destructive">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-destructive">Chyba</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-destructive">{previewLog.error_message}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
