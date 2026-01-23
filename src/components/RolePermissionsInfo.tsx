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

const PERMISSIONS: PermissionItem[] = [
  { label: "Zobrazit a spravovat záznamy školení", user: true, manager: true, admin: true },
  { label: "Spravovat zaměstnance", user: false, manager: true, admin: true },
  { label: "Spravovat oddělení", user: false, manager: true, admin: true },
  { label: "Spravovat typy školení", user: false, manager: true, admin: true },
  { label: "Mazat záznamy školení", user: false, manager: true, admin: true },
  { label: "Zobrazit audit log", user: false, manager: true, admin: true },
  { label: "Administrace - nastavení systému", user: false, manager: false, admin: true },
  { label: "Stav systému a logy připomínek", user: false, manager: false, admin: true },
  { label: "Export logů připomínek", user: false, manager: false, admin: true },
  { label: "Nastavení email providera", user: false, manager: false, admin: true },
  { label: "Konfigurace příjemců připomínek", user: false, manager: false, admin: true },
  { label: "Správa uživatelských rolí", user: false, manager: false, admin: true },
  { label: "Konfigurace frekvence připomínek", user: false, manager: false, admin: true },
  { label: "Spouštět testovací emaily", user: false, manager: false, admin: true },
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
          Přehled oprávnění pro jednotlivé role v systému
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Role descriptions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg border bg-green-500/5 border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-green-600" />
                <span className="font-medium">Uživatel</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Může zobrazovat a spravovat záznamy školení dle oprávnění aplikace. 
                Nemá přístup k nastavení systému, logům ani exportům.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-blue-500/5 border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Manažer</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Může spravovat zaměstnance, oddělení a typy školení. 
                Nemá přístup k administraci, logům připomínek ani nastavení emailů.
                Manažeři nejsou automaticky příjemci připomínek.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-red-500/5 border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-red-600" />
                <span className="font-medium">Admin</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Plná oprávnění: vše co manažer + správa uživatelských rolí, 
                konfigurace připomínek a emailů, přístup k logům a systémovému stavu.
              </p>
            </div>
          </div>

          <Separator />

          {/* Permissions table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Oprávnění</th>
                  <th className="text-center px-4 py-2">
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                      Uživatel
                    </Badge>
                  </th>
                  <th className="text-center px-4 py-2">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30">
                      Manažer
                    </Badge>
                  </th>
                  <th className="text-center px-4 py-2">
                    <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
                      Admin
                    </Badge>
                  </th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((perm, idx) => (
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
      </CardContent>
    </Card>
  );
}
