import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, Mail, User, Calendar, CheckCircle2, XCircle, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface EmailPreviewDialogProps {
  log: {
    id: string;
    template_name: string;
    recipient_emails: string[];
    email_subject: string;
    email_body: string;
    sent_at: string;
    status: string;
    error_message: string | null;
    is_test: boolean;
    provider_used: string | null;
    trainings?: {
      employees?: { first_name: string; last_name: string } | null;
      training_types?: { name: string } | null;
    } | null;
  };
  trigger?: React.ReactNode;
}

export function EmailPreviewDialog({ log, trigger }: EmailPreviewDialogProps) {
  const getStatusBadge = () => {
    if (log.status === "simulated") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <FlaskConical className="w-3 h-3" />
          Simulováno
        </Badge>
      );
    }
    if (log.status === "sent") {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-primary">
          <CheckCircle2 className="w-3 h-3" />
          Odesláno
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Chyba
      </Badge>
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Eye className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Náhled emailu
          </DialogTitle>
          <DialogDescription>
            Detail odeslaného emailu
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Stav</p>
              <div className="flex items-center gap-2">
                {getStatusBadge()}
                {log.is_test && (
                  <Badge variant="outline" className="text-xs">
                    <FlaskConical className="w-3 h-3 mr-1" />
                    Test
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Odesláno</p>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {format(new Date(log.sent_at), "d. MMMM yyyy 'v' HH:mm:ss", { locale: cs })}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Šablona</p>
              <p className="text-sm font-medium">{log.template_name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Provider</p>
              <p className="text-sm font-medium">{log.provider_used || "—"}</p>
            </div>
            {log.trainings && (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Zaměstnanec</p>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {log.trainings.employees 
                        ? `${log.trainings.employees.first_name} ${log.trainings.employees.last_name}`
                        : "—"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Školení</p>
                  <p className="text-sm font-medium">{log.trainings.training_types?.name || "—"}</p>
                </div>
              </>
            )}
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Příjemci</p>
            <div className="flex flex-wrap gap-2">
              {log.recipient_emails.map((email, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {email}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Email content */}
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Předmět</p>
              <div className="p-3 bg-background border rounded-lg">
                <p className="font-medium">{log.email_subject}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Tělo emailu</p>
              <div className="p-4 bg-background border rounded-lg min-h-[200px]">
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: log.email_body.replace(/\n/g, "<br>") 
                  }} 
                />
              </div>
            </div>
          </div>

          {/* Error message */}
          {log.error_message && (
            <>
              <Separator />
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-medium text-destructive mb-1">Chybová zpráva</p>
                <p className="text-sm text-destructive">{log.error_message}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}