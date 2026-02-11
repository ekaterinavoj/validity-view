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
  // Školení
  { label: "Zobrazit a spravovat záznamy školení", user: true, manager: true, admin: true },
  { label: "Spravovat zaměstnance a školené osoby", user: false, manager: true, admin: true },
  { label: "Spravovat typy školení a oddělení", user: false, manager: true, admin: true },
  { label: "Mazat záznamy školení", user: false, manager: true, admin: true },
  // Technické lhůty
  { label: "Zobrazit a spravovat technické lhůty", user: true, manager: true, admin: true },
  { label: "Spravovat zařízení a typy lhůt", user: false, manager: true, admin: true },
  { label: "Mazat záznamy technických lhůt", user: false, manager: true, admin: true },
  // Sdílené
  { label: "Spravovat provozovny (číselník)", user: false, manager: true, admin: true },
  { label: "Import/export dat (školení i technické)", user: false, manager: true, admin: true },
  { label: "Zobrazit audit log", user: false, manager: true, admin: true },
  // Admin only
  { label: "Administrace - nastavení systému", user: false, manager: false, admin: true },
  { label: "Stav systému a logy připomínek", user: false, manager: false, admin: true },
  { label: "Export logů připomínek", user: false, manager: false, admin: true },
  { label: "Nastavení email providera", user: false, manager: false, admin: true },
  { label: "Konfigurace příjemců připomínek (Školení i Technické)", user: false, manager: false, admin: true },
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
            <div className="p-3 rounded-lg border bg-role-user/5 border-role-user/20">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-role-user" />
                <span className="font-medium">Uživatel</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Může zobrazovat a spravovat záznamy školení i technických lhůt. 
                Nemá přístup k nastavení systému, logům ani exportům.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-role-manager/5 border-role-manager/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-role-manager" />
                <span className="font-medium">Manažer</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Může spravovat zaměstnance, oddělení, typy školení, zařízení a typy lhůt. 
                Nemá přístup k administraci, logům připomínek ani nastavení emailů.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-role-admin/5 border-role-admin/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-role-admin" />
                <span className="font-medium">Admin</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Plná oprávnění: vše co manažer + správa uživatelských rolí, 
                konfigurace připomínek (Školení + Technické lhůty), emailů a přístup k logům.
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
                    <Badge variant="outline" className="bg-role-user/10 text-role-user border-role-user/30">
                      Uživatel
                    </Badge>
                  </th>
                  <th className="text-center px-4 py-2">
                    <Badge variant="outline" className="bg-role-manager/10 text-role-manager border-role-manager/30">
                      Manažer
                    </Badge>
                  </th>
                  <th className="text-center px-4 py-2">
                    <Badge variant="outline" className="bg-role-admin/10 text-role-admin border-role-admin/30">
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
