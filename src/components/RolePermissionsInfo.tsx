import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Users, User, Check, X } from "lucide-react";

interface PermissionItem {
  label: string;
  user: boolean;
  manager: boolean;
  admin: boolean;
}

interface PermissionGroup {
  title: string;
  items: PermissionItem[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "Moduly událostí (Školení / Technické události / PLP)",
    items: [
      { label: "Zobrazit naplánované záznamy v přiřazených modulech", user: true, manager: true, admin: true },
      { label: "Vytvářet a upravovat školení a technické události", user: false, manager: true, admin: true },
      { label: "Vytvářet a upravovat lékařské prohlídky (PLP)", user: false, manager: false, admin: true },
      { label: "Zobrazit historii (archivované záznamy)", user: false, manager: true, admin: true },
      { label: "Mazat jednotlivé záznamy", user: false, manager: true, admin: true },
      { label: "Hromadné akce (obnova, trvalé smazání) v historii", user: false, manager: false, admin: true },
    ],
  },
  {
    title: "Správa dat (Zaměstnanci, Provozovny, Střediska, Typy událostí, Statistiky)",
    items: [
      { label: "Zobrazit a spravovat zaměstnance", user: false, manager: true, admin: true },
      { label: "Spravovat provozovny a střediska", user: false, manager: true, admin: true },
      { label: "Spravovat typy školení, prohlídek a technických událostí", user: false, manager: true, admin: true },
      { label: "Zobrazit přehled typů událostí napříč moduly", user: false, manager: true, admin: true },
      { label: "Zobrazit statistiky", user: false, manager: true, admin: true },
      { label: "Zobrazit pozastavená školení (inaktivní zaměstnanci)", user: false, manager: true, admin: true },
    ],
  },
  {
    title: "Konfigurace modulů (Zařízení, Skupiny odpovědných, Šablony)",
    items: [
      { label: "Spravovat zařízení a šablony připomínek", user: false, manager: true, admin: true },
      { label: "Spravovat skupiny odpovědných osob", user: false, manager: true, admin: true },
      { label: "Konfigurace frekvence a textu připomínek", user: false, manager: false, admin: true },
    ],
  },
  {
    title: "Dokumenty",
    items: [
      { label: "Zobrazovat a stahovat firemní dokumenty", user: true, manager: true, admin: true },
      { label: "Nahrávat a mazat firemní dokumenty", user: false, manager: true, admin: true },
    ],
  },
  {
    title: "Systém (Audit, Stav, Administrace, Migrace DB)",
    items: [
      { label: "Audit log – přehled všech akcí", user: false, manager: false, admin: true },
      { label: "Stav systému, logy připomínek, export logů", user: false, manager: false, admin: true },
      { label: "Administrace – uživatelé, role, e-maily, SMTP", user: false, manager: false, admin: true },
      { label: "Migrace databáze", user: false, manager: false, admin: true },
      { label: "Spouštět testovací e-maily", user: false, manager: false, admin: true },
    ],
  },
  {
    title: "Vlastní profil",
    items: [
      { label: "Zobrazit a upravit svůj profil, změnit heslo", user: true, manager: true, admin: true },
      { label: "Nastavení zobrazení (barva, řazení sloupců)", user: true, manager: true, admin: true },
    ],
  },
];

const PermissionIcon = ({ allowed }: { allowed: boolean }) => (
  allowed
    ? <Check className="w-4 h-4 text-primary" />
    : <X className="w-4 h-4 text-muted-foreground/40" />
);

export function RolePermissionsInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Role a oprávnění
        </CardTitle>
        <CardDescription>
          Přehled oprávnění pro jednotlivé role v systému. Přístup k modulům
          (Školení, Technické události, PLP) se navíc nastavuje individuálně
          pro každého uživatele v Administraci.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Role descriptions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg border bg-role-user/5 border-role-user/20">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-role-user" />
                <span className="font-medium">Uživatel</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Vidí pouze naplánované záznamy v přiřazených modulech a firemní
                Dokumenty (jen čtení). Nemá přístup ke Správě dat, Historii,
                konfiguraci ani Systému.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-role-manager/5 border-role-manager/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-role-manager" />
                <span className="font-medium">Manažer</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Vše co Uživatel + plná Správa dat (Zaměstnanci, Provozovny,
                Střediska, Typy událostí, Statistiky), Historie, konfigurace
                modulů a nahrávání Dokumentů. Nemá přístup k Systému ani
                k vytváření PLP prohlídek.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-role-admin/5 border-role-admin/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-role-admin" />
                <span className="font-medium">Admin</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Plná oprávnění: vše co Manažer + Systém (Audit log, Stav
                systému, Administrace uživatelů a rolí, Migrace DB, e-maily
                a SMTP) a hromadné akce v Historii.
              </p>
            </div>
          </div>

          <Separator />

          {/* Permissions tables grouped by area */}
          <div className="space-y-6">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.title} className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{group.title}</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium">Oprávnění</th>
                        <th className="text-center px-4 py-2 w-24">
                          <Badge variant="outline" className="bg-role-user/10 text-role-user border-role-user/30">
                            Uživatel
                          </Badge>
                        </th>
                        <th className="text-center px-4 py-2 w-24">
                          <Badge variant="outline" className="bg-role-manager/10 text-role-manager border-role-manager/30">
                            Manažer
                          </Badge>
                        </th>
                        <th className="text-center px-4 py-2 w-24">
                          <Badge variant="outline" className="bg-role-admin/10 text-role-admin border-role-admin/30">
                            Admin
                          </Badge>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((perm, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">{perm.label}</td>
                          <td className="text-center px-4 py-2">
                            <PermissionIcon allowed={perm.user} />
                          </td>
                          <td className="text-center px-4 py-2">
                            <PermissionIcon allowed={perm.manager} />
                          </td>
                          <td className="text-center px-4 py-2">
                            <PermissionIcon allowed={perm.admin} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
