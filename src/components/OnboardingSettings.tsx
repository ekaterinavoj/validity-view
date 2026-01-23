import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Plus, X, Shield, Users, Lock, Mail, Loader2, Save } from "lucide-react";

interface OnboardingSettingsProps {
  onSave?: () => void;
}

export function OnboardingSettings({ onSave }: OnboardingSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [registrationMode, setRegistrationMode] = useState<'invite_only' | 'self_signup_approval'>('self_signup_approval');
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: modeData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'registration_mode')
        .maybeSingle();
      
      if (modeData?.value && typeof modeData.value === 'object' && 'mode' in modeData.value) {
        setRegistrationMode((modeData.value as { mode: string }).mode as 'invite_only' | 'self_signup_approval');
      }

      const { data: allowlistData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'registration_allowlist')
        .maybeSingle();
      
      if (allowlistData?.value && typeof allowlistData.value === 'object') {
        const allowlist = allowlistData.value as { domains?: string[]; emails?: string[] };
        setAllowedDomains(allowlist.domains || []);
        setAllowedEmails(allowlist.emails || []);
      }
    } catch (error: any) {
      toast({
        title: "Chyba při načítání nastavení",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: any) => {
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id')
      .eq('key', key)
      .maybeSingle();
    
    if (existing) {
      const { error } = await supabase
        .from('system_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('system_settings')
        .insert({ key, value, description: `Setting: ${key}` });
      if (error) throw error;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        saveSetting('registration_mode', { mode: registrationMode }),
        saveSetting('registration_allowlist', { domains: allowedDomains, emails: allowedEmails }),
      ]);
      
      toast({
        title: "Nastavení uloženo",
        description: "Nastavení registrace bylo úspěšně uloženo.",
      });
      
      onSave?.();
    } catch (error: any) {
      toast({
        title: "Chyba při ukládání",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase();
    if (domain && !allowedDomains.includes(domain)) {
      // Validate domain format
      if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/.test(domain)) {
        toast({
          title: "Neplatná doména",
          description: "Zadejte platnou doménu (např. firma.cz)",
          variant: "destructive",
        });
        return;
      }
      setAllowedDomains([...allowedDomains, domain]);
      setNewDomain('');
    }
  };

  const handleRemoveDomain = (domain: string) => {
    setAllowedDomains(allowedDomains.filter(d => d !== domain));
  };

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (email && !allowedEmails.includes(email)) {
      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast({
          title: "Neplatný email",
          description: "Zadejte platnou emailovou adresu",
          variant: "destructive",
        });
        return;
      }
      setAllowedEmails([...allowedEmails, email]);
      setNewEmail('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setAllowedEmails(allowedEmails.filter(e => e !== email));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Registration Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Režim registrace uživatelů
          </CardTitle>
          <CardDescription>
            Vyberte, jak se mohou noví uživatelé registrovat do systému
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={registrationMode}
            onValueChange={(value) => setRegistrationMode(value as 'invite_only' | 'self_signup_approval')}
          >
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="invite_only" id="invite_only" className="mt-1" />
              <div className="flex-1">
                <label htmlFor="invite_only" className="font-medium cursor-pointer flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Pouze na pozvánku
                  <Badge variant="outline" className="ml-2">Doporučeno</Badge>
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  Veřejná registrace je zakázána. Pouze administrátor může vytvořit pozvánku pro nového uživatele.
                  Uživatelé se mohou registrovat pouze s platnou pozvánkou.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="self_signup_approval" id="self_signup_approval" className="mt-1" />
              <div className="flex-1">
                <label htmlFor="self_signup_approval" className="font-medium cursor-pointer flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Registrace se schválením
                </label>
                <p className="text-sm text-muted-foreground mt-1">
                  Uživatelé se mohou registrovat sami, ale jejich účet zůstane neaktivní (pending),
                  dokud je administrátor neschválí a nepřidělí jim roli.
                </p>
              </div>
            </div>
          </RadioGroup>

          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-primary">Bezpečnostní poznámka</p>
              <p className="text-muted-foreground">
                Neschválení uživatelé jsou blokováni na úrovni databáze (RLS) a nemají přístup k žádným datům.
                Všechny změny jsou zaznamenávány v audit logu.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Allowlist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Povolené domény a emaily
          </CardTitle>
          <CardDescription>
            Omezte registraci pouze na konkrétní emailové domény nebo adresy.
            Pokud je seznam prázdný, povoleny jsou všechny domény (ale stále vyžadují schválení).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Allowed Domains */}
          <div className="space-y-3">
            <Label>Povolené domény</Label>
            <div className="flex flex-wrap gap-2">
              {allowedDomains.length === 0 && (
                <p className="text-sm text-muted-foreground">Všechny domény jsou povoleny</p>
              )}
              {allowedDomains.map((domain) => (
                <Badge key={domain} variant="secondary" className="py-1 px-3">
                  @{domain}
                  <button
                    onClick={() => handleRemoveDomain(domain)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="firma.cz"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDomain())}
                className="max-w-xs"
              />
              <Button variant="outline" onClick={handleAddDomain}>
                <Plus className="w-4 h-4 mr-2" />
                Přidat
              </Button>
            </div>
          </div>

          <Separator />

          {/* Allowed Emails */}
          <div className="space-y-3">
            <Label>Povolené konkrétní emaily</Label>
            <div className="flex flex-wrap gap-2">
              {allowedEmails.length === 0 && (
                <p className="text-sm text-muted-foreground">Žádné konkrétní emaily</p>
              )}
              {allowedEmails.map((email) => (
                <Badge key={email} variant="secondary" className="py-1 px-3">
                  {email}
                  <button
                    onClick={() => handleRemoveEmail(email)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="uzivatel@firma.cz"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmail())}
                className="max-w-xs"
              />
              <Button variant="outline" onClick={handleAddEmail}>
                <Plus className="w-4 h-4 mr-2" />
                Přidat
              </Button>
            </div>
          </div>

          {(allowedDomains.length > 0 || allowedEmails.length > 0) && (
            <div className="p-3 bg-muted/50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Pouze uživatelé s emailem na povolené doméně nebo v seznamu povolených emailů
                se budou moci registrovat. Ostatní budou odmítnuti při pokusu o registraci.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Uložit nastavení registrace
        </Button>
      </div>
    </div>
  );
}