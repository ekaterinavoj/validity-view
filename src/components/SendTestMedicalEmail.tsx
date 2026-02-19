import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Send, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Mail
} from "lucide-react";

interface SendTestMedicalEmailProps {
  hasRecipients: boolean;
  isEnabled: boolean;
}

export function SendTestMedicalEmail({ hasRecipients, isEnabled }: SendTestMedicalEmailProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendTest = async () => {
    setSending(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("run-medical-reminders", {
        body: { 
          triggered_by: "manual_test",
          test_mode: true,
        },
      });

      if (error) throw error;

      if (data?.error || data?.warning) {
        setResult({ 
          success: false, 
          message: data.error || data.warning 
        });
      } else if (data?.info) {
        // Edge function returned early (e.g. no examinations need attention)
        setResult({
          success: true,
          message: data.info,
        });
      } else {
        const recipientCount = data?.recipientCount || data?.emailsSent || 0;
        setResult({ 
          success: true, 
          message: `Testovací email byl úspěšně odeslán ${recipientCount} příjemcům.` 
        });
        toast({
          title: "Testovací email odeslán",
          description: `Email byl odeslán ${recipientCount} příjemcům.`,
        });
      }
    } catch (error: any) {
      setResult({ 
        success: false, 
        message: error.message 
      });
      toast({
        title: "Chyba při odesílání",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => open ? setIsOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button 
          variant="secondary"
          disabled={!hasRecipients || !isEnabled}
          className="w-full"
        >
          <Send className="w-4 h-4 mr-2" />
          Odeslat testovací souhrnný email (PLP)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Odeslat testovací email (PLP)
          </DialogTitle>
          <DialogDescription>
            Toto odešle skutečný souhrnný email o lékařských prohlídkách všem vybraným příjemcům pro ověření konfigurace.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {result ? (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              result.success 
                ? "bg-primary/10 border border-primary/30" 
                : "bg-destructive/10 border border-destructive/30"
            }`}>
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${result.success ? "text-primary" : "text-destructive"}`}>
                  {result.success ? "Úspěch" : "Chyba"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.message}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Upozornění</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tento email bude skutečně odeslán všem vybraným příjemcům lékařských prohlídek. 
                    Použijte pro ověření, že emailová konfigurace funguje správně.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? "Zavřít" : "Zrušit"}
          </Button>
          {!result && (
            <Button onClick={handleSendTest} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Odesílám...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Odeslat nyní
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
