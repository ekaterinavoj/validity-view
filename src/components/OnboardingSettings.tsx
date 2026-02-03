import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, UserPlus, Lock, CheckCircle } from "lucide-react";

export function OnboardingSettings() {
  return (
    <div className="space-y-6">
      {/* Admin-only provisioning info */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Režim správy uživatelů
            <Badge className="bg-primary">Aktivní</Badge>
          </CardTitle>
          <CardDescription>
            Tento systém používá výhradně administrátorské zřizování uživatelů
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-background rounded-lg border">
            <Lock className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Pouze administrátor může vytvářet účty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Veřejná registrace ani registrace na pozvánku nejsou povoleny. 
                Všechny uživatelské účty vytváří administrátor v sekci <strong>Uživatelé</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-background rounded-lg border">
            <UserPlus className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Jak přidat nového uživatele</p>
              <ol className="text-sm text-muted-foreground mt-2 space-y-2 list-decimal list-inside">
                <li>Přejděte do záložky <strong>Uživatelé</strong></li>
                <li>Klikněte na tlačítko <strong>Přidat uživatele</strong></li>
                <li>Vyplňte email, jméno a vyberte zaměstnance</li>
                <li>Nastavte roli (Uživatel / Manažer / Administrátor)</li>
                <li>Vyberte moduly, ke kterým bude mít přístup</li>
                <li>Zadejte počáteční heslo nebo ho nechte vygenerovat</li>
                <li>Heslo předejte uživateli bezpečným způsobem</li>
              </ol>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-background rounded-lg border">
            <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Výhody tohoto režimu</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Plná kontrola nad tím, kdo má přístup do systému</li>
                <li>• Každý účet je od začátku správně propojen se zaměstnancem</li>
                <li>• Není nutné schvalovat registrace ani spravovat pozvánky</li>
                <li>• Administrátor má přehled o všech přístupech</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role permissions info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Přehled rolí a oprávnění
          </CardTitle>
          <CardDescription>
            Každá role má definovaná oprávnění pro práci s daty
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-destructive">Administrátor</Badge>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Plný přístup ke všem datům</li>
                <li>• Správa uživatelů a rolí</li>
                <li>• Nastavení systému</li>
                <li>• Přístup k audit logu</li>
                <li>• Všechny moduly automaticky</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-primary">Manažer</Badge>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Vidí svá data a data podřízených</li>
                <li>• Může vytvářet a editovat záznamy</li>
                <li>• Nemůže spravovat uživatele</li>
                <li>• Přístup k audit logu (čtení)</li>
                <li>• Moduly dle přidělení</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-secondary text-secondary-foreground">Uživatel</Badge>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Vidí pouze svá vlastní data</li>
                <li>• Může vytvářet záznamy</li>
                <li>• Omezené možnosti editace</li>
                <li>• Žádný přístup k administraci</li>
                <li>• Moduly dle přidělení</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
