import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProbationObstacles } from "@/hooks/useProbationObstacles";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDate } from "@/lib/dateFormat";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { format } from "date-fns";

interface Props {
  employeeId: string | null;
  canEdit: boolean;
}

export function ProbationObstaclesSection({ employeeId, canEdit }: Props) {
  const { obstacles, loading, error, totalDays, add, remove } = useProbationObstacles(employeeId);
  const { isAdmin, isManager } = useAuth();
  const { toast } = useToast();

  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const allowEdit = canEdit && (isAdmin || isManager);

  const handleAdd = async () => {
    if (!from || !to || !reason.trim()) {
      toast({ title: "Vyplňte všechna pole", variant: "destructive" });
      return;
    }
    if (to < from) {
      toast({ title: "Datum 'do' musí být větší nebo rovno 'od'", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await add({
        dateFrom: format(from, "yyyy-MM-dd"),
        dateTo: format(to, "yyyy-MM-dd"),
        reason: reason.trim(),
      });
      setFrom(undefined);
      setTo(undefined);
      setReason("");
      toast({ title: "Překážka přidána. Konec ZD byl přepočítán." });
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message ?? "Nelze přidat překážku", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await remove(id);
      toast({ title: "Překážka smazána. Konec ZD byl přepočítán." });
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    }
  };

  if (!employeeId) {
    return (
      <p className="text-xs text-muted-foreground">
        Překážky bude možné přidat po uložení nového zaměstnance.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Celodenní překážky v práci automaticky prodlužují konec ZD
          {totalDays > 0 && (
            <> – aktuálně přidáno <strong>{totalDays}</strong> dní.</>
          )}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Od</TableHead>
              <TableHead>Do</TableHead>
              <TableHead className="text-center">Dní</TableHead>
              <TableHead>Důvod</TableHead>
              {allowEdit && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={allowEdit ? 5 : 4} className="text-center py-4 text-muted-foreground">
                  Načítání…
                </TableCell>
              </TableRow>
            ) : obstacles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={allowEdit ? 5 : 4} className="p-0">
                  <EmptyState
                    title="Žádné překážky"
                    description="Pokud zaměstnanec celodenně nepracoval během ZD (nemoc, volno…), zaznamenejte dny zde."
                  />
                </TableCell>
              </TableRow>
            ) : (
              obstacles.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{formatDisplayDate(o.dateFrom)}</TableCell>
                  <TableCell>{formatDisplayDate(o.dateTo)}</TableCell>
                  <TableCell className="text-center">{o.days}</TableCell>
                  <TableCell className="text-sm">{o.reason}</TableCell>
                  {allowEdit && (
                    <TableCell>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemove(o.id)}
                        aria-label="Smazat překážku"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {allowEdit && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end pt-1">
          <div>
            <Label className="text-xs">Od</Label>
            <DateInput value={from} onChange={setFrom} />
          </div>
          <div>
            <Label className="text-xs">Do</Label>
            <DateInput value={to} onChange={setTo} />
          </div>
          <div>
            <Label className="text-xs">Důvod</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="např. Pracovní neschopnost" />
          </div>
          <Button type="button" onClick={handleAdd} disabled={submitting}>
            <Plus className="h-4 w-4 mr-1" /> Přidat
          </Button>
        </div>
      )}
    </div>
  );
}
