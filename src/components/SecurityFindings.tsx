import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";

type Status = "active" | "fixed" | "ignored";
type Severity = "error" | "warn" | "info";

interface Finding {
  id: string;
  name: string;
  severity: Severity;
  status: Status;
  date: string;
  migration?: string;
  description: string;
}

const FINDINGS: Finding[] = [
  {
    id: "medical_documents_storage_any_authenticated_access",
    name: "Storage medical-documents – plný přístup pro všechny",
    severity: "error",
    status: "fixed",
    date: "2026-04-24",
    migration: "20260424105523",
    description:
      "Storage politiky ověřovaly pouze auth.role()=authenticated. Nově přístup řídí can_access_medical_examination (admin/self uploader/self linked employee/manager hierarchie).",
  },
  {
    id: "training_documents_storage_no_approval",
    name: "Storage training-documents – chybí kontrola schválení a vlastnictví",
    severity: "error",
    status: "fixed",
    date: "2026-04-24",
    migration: "20260424105523",
    description:
      "Politiky nově vyžadují schválený účet a omezují čtení na admina, autora školení, uploadera, samotného zaměstnance nebo jeho manažera.",
  },
  {
    id: "realtime_messages_no_rls",
    name: "Realtime – odběr libovolného kanálu autentizovanými uživateli",
    severity: "error",
    status: "fixed",
    date: "2026-04-24",
    migration: "20260424104837",
    description:
      "Na realtime.messages je zapnuté RLS, klientské zápisy zablokované a odběr je dostupný jen schváleným uživatelům. UI navíc předem ověří roli/modul a logne důvod odmítnutí.",
  },
  {
    id: "responsibility_groups_broken_manager_policy",
    name: "responsibility_groups – chybný self-join v manager policy",
    severity: "warn",
    status: "fixed",
    date: "2026-04-24",
    migration: "20260424104837",
    description:
      "Politika porovnávala rgm.group_id = rgm.id. Opraveno na rgm.group_id = responsibility_groups.id AND rgm.profile_id = auth.uid().",
  },
  {
    id: "seed_initial_admin_unauthenticated",
    name: "Seed admin endpoint – neautentizovaný se zakódovanými údaji (outdated)",
    severity: "error",
    status: "ignored",
    date: "2026-04-24",
    description:
      "Vyhodnoceno jako outdated – endpoint je guardován a slouží jen pro inicializaci prvního admina. Vynucuje povinnou změnu hesla.",
  },
  {
    id: "apply_migrations_sql_endpoint",
    name: "Apply migrations – arbitrary SQL execution (outdated)",
    severity: "warn",
    status: "ignored",
    date: "2026-04-24",
    description:
      "Designovaná funkce pro self-hosted instance, voláná pouze adminem s JWT. Outdated nález.",
  },
];

const severityBadge = (s: Severity) =>
  s === "error" ? "destructive" : s === "warn" ? "secondary" : "outline";

const statusInfo: Record<Status, { label: string; icon: typeof CheckCircle2; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "aktivní", icon: AlertTriangle, variant: "secondary" },
  fixed: { label: "opraveno", icon: CheckCircle2, variant: "default" },
  ignored: { label: "ignorováno (outdated)", icon: CheckCircle2, variant: "outline" },
};

export function SecurityFindings() {
  const counts = FINDINGS.reduce(
    (acc, f) => {
      acc[f.status]++;
      return acc;
    },
    { active: 0, fixed: 0, ignored: 0 } as Record<Status, number>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Bezpečnostní nálezy
        </CardTitle>
        <CardDescription>
          Přehled bezpečnostních nálezů (aktivní, opravené, ignorované) s datem a odkazem na
          konkrétní databázovou migraci.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">aktivní: {counts.active}</Badge>
          <Badge variant="default">opraveno: {counts.fixed}</Badge>
          <Badge variant="outline">ignorováno: {counts.ignored}</Badge>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nález</TableHead>
                <TableHead>Závažnost</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Migrace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FINDINGS.map((f) => {
                const Icon = statusInfo[f.status].icon;
                return (
                  <TableRow key={f.id}>
                    <TableCell className="space-y-1">
                      <div className="font-medium">{f.name}</div>
                      <div className="text-xs text-muted-foreground">{f.description}</div>
                      <code className="text-[10px] text-muted-foreground">{f.id}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityBadge(f.severity)}>{f.severity}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo[f.status].variant} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {statusInfo[f.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.date}</TableCell>
                    <TableCell>
                      {f.migration ? (
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {f.migration}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
