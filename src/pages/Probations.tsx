import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEmployees } from "@/hooks/useEmployees";
import { ProbationBadge } from "@/components/ProbationBadge";
import { DepartmentCell } from "@/components/DepartmentCell";
import { Search, X, ClipboardList } from "lucide-react";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { formatDisplayDate } from "@/lib/dateFormat";

type WindowFilter = "ending_14" | "ending_30" | "ending_60" | "all_active";

function daysUntil(end: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(end);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export default function Probations() {
  const { employees, loading, error } = useEmployees();
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("ending_30");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return employees
      .filter((e) => e.status === "employed" && e.probationEndDate)
      .filter((e) => {
        const days = daysUntil(e.probationEndDate!);
        if (windowFilter === "ending_14") return days >= 0 && days <= 14;
        if (windowFilter === "ending_30") return days >= 0 && days <= 30;
        if (windowFilter === "ending_60") return days >= 0 && days <= 60;
        return true; // all_active – all employed with probation
      })
      .filter((e) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          (e.employeeNumber || "").toLowerCase().includes(q) ||
          (e.position || "").toLowerCase().includes(q) ||
          (e.email || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const da = daysUntil(a.probationEndDate!);
        const db = daysUntil(b.probationEndDate!);
        return da - db;
      });
  }, [employees, windowFilter, search]);

  const hasFilters = search !== "" || windowFilter !== "ending_30";

  if (loading) return <TableSkeleton />;
  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-engel-blue" />
          <h1 className="text-2xl font-semibold">Zkušební doby</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Přehled aktivních zaměstnanců s blížícím se koncem zkušební doby. Notifikace
          v aplikaci se generují <strong>14 dní před koncem</strong> a <strong>v den konce</strong>
          {" "}pro administrátory a přímého nadřízeného.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat (jméno, číslo, pozice, email)..."
              className="pl-8"
            />
          </div>
          <Select value={windowFilter} onValueChange={(v) => setWindowFilter(v as WindowFilter)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ending_14">Končí do 14 dní</SelectItem>
              <SelectItem value="ending_30">Končí do 30 dní</SelectItem>
              <SelectItem value="ending_60">Končí do 60 dní</SelectItem>
              <SelectItem value="all_active">Všichni aktivní v ZD</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearch(""); setWindowFilter("ending_30"); }}
            >
              <X className="h-4 w-4 mr-1" /> Vyčistit
            </Button>
          )}
          <span className="ml-auto text-sm text-muted-foreground">
            Celkem: {filtered.length}
          </span>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Os. číslo</TableHead>
              <TableHead>Jméno</TableHead>
              <TableHead>Pozice</TableHead>
              <TableHead>Středisko</TableHead>
              <TableHead>Datum nástupu</TableHead>
              <TableHead>Délka (měs.)</TableHead>
              <TableHead>Konec ZD</TableHead>
              <TableHead>Nadřízený</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Žádní zaměstnanci v tomto okně neexistují.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.employeeNumber || "-"}</TableCell>
                  <TableCell>{e.firstName} {e.lastName}</TableCell>
                  <TableCell className="text-sm">{e.position}</TableCell>
                  <TableCell className="text-sm">
                    <DepartmentCell code={e.department} name={e.departmentName} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {e.startDate ? formatDisplayDate(e.startDate) : "-"}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {e.probationMonths ?? "-"}
                  </TableCell>
                  <TableCell>
                    <ProbationBadge endDate={e.probationEndDate} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.managerFirstName || e.managerLastName
                      ? `${e.managerFirstName || ""} ${e.managerLastName || ""}`.trim()
                      : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
