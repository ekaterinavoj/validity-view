import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Mail,
  User
} from "lucide-react";

interface SendSingleTestEmailProps {
  isEnabled: boolean;
}

export function SendSingleTestEmail({ isEnabled }: SendSingleTestEmailProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendTest = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast({
        title: "Neplatný email",
        description: "Zadejte platnou emailovou adresu",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("run-reminders", {
        body: { 
          triggered_by: "single_test",
          test_mode: true,
          single_recipient_email: testEmail,
        },
      });

      if (error) throw error;

      if (data?.error || data?.warning) {
        setResult({ 
          success: false, 
          message: data.error || data.warning 
        });
      } else {
        setResult({ 
          success: true, 
          message: `Testovací email byl úspěšně odeslán na ${testEmail}.` 
        });
        toast({
          title: "Testovací email odeslán",
          description: `Email byl odeslán na ${testEmail}.`,
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
    setTestEmail("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => open ? setIsOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button 
          variant="outline"
          disabled={!isEnabled}
          className="w-full"
        >
          <User className="w-4 h-4 mr-2" />
          Odeslat náhled na jednu adresu
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Odeslat testovací náhled
          </DialogTitle>
          <DialogDescription>
            Odešlete náhled souhrnného emailu na jednu testovací adresu pro ověření formátování.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
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
            <>
              <div className="space-y-2">
                <Label htmlFor="test-email">Testovací emailová adresa</Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Náhled emailu</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Email bude obsahovat aktuální data školení a bude označen jako [TEST]. 
                      Slouží pouze pro ověření vzhledu a formátování.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? "Zavřít" : "Zrušit"}
          </Button>
          {!result && (
            <Button onClick={handleSendTest} disabled={sending || !testEmail}>
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Odesílám...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Odeslat náhled
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
