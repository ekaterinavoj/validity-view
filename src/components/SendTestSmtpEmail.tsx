import { useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, CheckCircle, XCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SendTestSmtpEmailProps {
  smtpHost: string;
  smtpPort: number;
  smtpFromEmail: string;
  smtpAuthEnabled: boolean;
}

export function SendTestSmtpEmail({ 
  smtpHost, 
  smtpPort, 
  smtpFromEmail,
  smtpAuthEnabled 
}: SendTestSmtpEmailProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const handleSend = async () => {
    if (!email) return;
    
    setSending(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: { email },
      });

      if (error) {
        setResult({
          success: false,
          message: "Nepodařilo se odeslat testovací email",
          details: error.message,
        });
      } else if (data.success) {
        setResult({
          success: true,
          message: `Testovací email byl úspěšně odeslán na ${email}`,
          details: `Použitý provider: ${data.provider || "SMTP"}`,
        });
      } else {
        setResult({
          success: false,
          message: data.error || "Odeslání selhalo",
          details: data.configurationRequired 
            ? "Zkontrolujte konfiguraci SMTP serveru" 
            : `Provider: ${data.provider || "neznámý"}`,
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        message: "Chyba při komunikaci se serverem",
        details: err.message,
      });
    } finally {
      setSending(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setResult(null);
      setEmail("");
    }
  };

  const isConfigured = smtpHost && smtpFromEmail;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!isConfigured}>
          <Send className="w-4 h-4 mr-2" />
          Odeslat testovací email
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Odeslat testovací email
          </DialogTitle>
          <DialogDescription>
            Ověřte, že konfigurace SMTP serveru funguje správně odesláním testovacího emailu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* SMTP Info */}
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <p><strong>Server:</strong> {smtpHost}:{smtpPort}</p>
            <p><strong>Odesílatel:</strong> {smtpFromEmail}</p>
            <p><strong>Autorizace:</strong> {smtpAuthEnabled ? "Ano" : "Ne"}</p>
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="test-email">Email příjemce *</Label>
            <Input
              id="test-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vas@email.cz"
              disabled={sending}
            />
          </div>

          {/* Result */}
          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    <p className="font-medium">{result.message}</p>
                    {result.details && (
                      <p className="text-xs mt-1 opacity-80">{result.details}</p>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Zavřít
          </Button>
          <Button onClick={handleSend} disabled={!email || sending}>
            {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Odeslat test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
