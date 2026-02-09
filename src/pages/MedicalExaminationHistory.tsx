import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Loader2, RefreshCw, ArchiveRestore, Archive, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMedicalExaminationHistory } from "@/hooks/useMedicalExaminationHistory";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { supabase } from "@/integrations/supabase/client";
import { useFacilities } from "@/hooks/useFacilities";
import { useAuth } from "@/contexts/AuthContext";
import { BulkActionsBar } from "@/components/BulkActionsBar";
import { BulkArchiveDialog } from "@/components/BulkArchiveDialog";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const employeeStatusLabels: Record<string, string> = {
  employed: "Aktivní",
  parental_leave: "Mateřská/rodičovská",
  sick_leave: "Nemocenská",
  terminated: "Ukončený",
};

const employeeStatusColors: Record<string, string> = {
  employed: "bg-green-500",
  parental_leave: "bg-blue-500",
  sick_leave: "bg-yellow-500",
  terminated: "bg-red-500",
};

export default function MedicalExaminationHistory() {
  const { toast } = useToast();
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const canBulkActions = isAdmin;
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<string>("all");
  const [archiveFilter, setArchiveFilter] = useState<string>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRestoreDialogOpen, setBulkRestoreDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const includeArchived = archiveFilter === "all" || archiveFilter === "archived";
  const { examinations, loading, error, refetch } = useMedicalExaminationHistory(includeArchived);
  const { facilities: facilitiesData } = useFacilities();

  const facilityNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    facilitiesData.forEach(f => { map[f.code] = f.name; });
    return map;
  }, [facilitiesData]);

  const filteredHistory = useMemo(() => {
    return examinations.filter((exam) => {
      if (archiveFilter === "active" && exam.isArchived) return false;
      if (archiveFilter === "archived" && !exam.isArchived) return false;

      const matchesEmployeeStatus =
        employeeStatusFilter === "all" || exam.employeeStatus === employeeStatusFilter;

      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        searchQuery === "" ||
        exam.employeeName.toLowerCase().includes(searchLower) ||
        exam.employeeNumber.includes(searchLower) ||
        exam.type.toLowerCase().includes(searchLower) ||
        exam.department.toLowerCase().includes(searchLower) ||
        exam.doctor.toLowerCase().includes(searchLower);

      return matchesEmployeeStatus && matchesSearch;
    });
  }, [examinations, employeeStatusFilter, archiveFilter, searchQuery]);

  const selectableItems = useMemo(() =>
    filteredHistory.filter(t => t.isArchived),
    [filteredHistory]
  );

  const handleSelectAll = () => {
    if (selectedIds.length === selectableItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableItems.map(t => t.id));
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      const { error } = await supabase
        .from("medical_examinations")
        .update({ deleted_at: null, is_active: true })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Prohlídka obnovena", description: "Prohlídka byla úspěšně obnovena." });
      refetch();
    } catch (err: any) {
      toast({ title: "Chyba při obnovení", description: err.message, variant: "destructive" });
    } finally {
      setRestoringId(null);
    }
  };

  const handleArchive = async (id: string) => {
    setArchivingId(id);
    try {
      const { error } = await supabase
        .from("medical_examinations")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Prohlídka archivována", description: "Prohlídka byla přesunuta do archivu." });
      refetch();
    } catch (err: any) {
      toast({ title: "Chyba při archivaci", description: err.message, variant: "destructive" });
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await supabase.from("medical_examination_documents").delete().eq("examination_id", id);
      await supabase.from("medical_reminder_logs").delete().eq("examination_id", id);
      const { error } = await supabase.from("medical_examinations").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Prohlídka smazána", description: "Prohlídka byla trvale odstraněna." });
      setDeleteConfirmId(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Chyba při mazání", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkRestore = async () => {
    setBulkActionLoading(true);
    try {
      const { error } = await supabase
        .from("medical_examinations")
        .update({ deleted_at: null, is_active: true })
        .in("id", selectedIds);
      if (error) throw error;
      toast({ title: "Prohlídky obnoveny", description: `Bylo obnoveno ${selectedIds.length} prohlídek.` });
      setSelectedIds([]);
      setBulkRestoreDialogOpen(false);
      refetch();
    } catch (err: any) {
      toast({ title: "Chyba při obnovení", description: err.message, variant: "destructive" });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkActionLoading(true);
    try {
      const { data: examsData } = await supabase
        .from("medical_examination_documents")
        .select("id")
        .in("examination_id", selectedIds);
      
      if (examsData && examsData.length > 0) {
        await supabase
          .from("medical_examination_documents")
          .delete()
          .in("examination_id", selectedIds);
      }

      await supabase
        .from("medical_reminder_logs")
        .delete()
        .in("examination_id", selectedIds);

      const { error } = await supabase
        .from("medical_examinations")
        .delete()
        .in("id", selectedIds);
      if (error) throw error;
      toast({ title: "Prohlídky smazány", description: `Bylo trvale smazáno ${selectedIds.length} prohlídek.` });
      setSelectedIds([]);
      setBulkDeleteDialogOpen(false);
      refetch();
    } catch (err: any) {
      toast({ title: "Chyba při mazání", description: err.message, variant: "destructive" });
    } finally {
      setBulkActionLoading(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-foreground">Historie prohlídek</h2>
        <ErrorDisplay title="Nepodařilo se načíst historii" message={error} onRetry={refetch} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-foreground">Historie prohlídek</h2>
        <TableSkeleton columns={9} rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-foreground">Historie prohlídek</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hledat..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Archiv:</label>
            <Select value={archiveFilter} onValueChange={setArchiveFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktivní prohlídky</SelectItem>
                <SelectItem value="archived">Archivované</SelectItem>
                <SelectItem value="all">Vše</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Stav zaměstnance:</label>
            <Select value={employeeStatusFilter} onValueChange={setEmployeeStatusFilter}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všichni zaměstnanci</SelectItem>
                <SelectItem value="employed">Aktivní</SelectItem>
                <SelectItem value="parental_leave">Mateřská/rodičovská</SelectItem>
                <SelectItem value="sick_leave">Nemocenská</SelectItem>
                <SelectItem value="terminated">Ukončený</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {searchQuery && (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery("")}>
              <X className="w-4 h-4 mr-1" />
              Vymazat
            </Button>
          )}
        </div>
      </Card>

      {/* Bulk Actions */}
      {canBulkActions && archiveFilter !== "active" && selectableItems.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.length}
          onClearSelection={() => setSelectedIds([])}
          onBulkRestore={() => setBulkRestoreDialogOpen(true)}
          onBulkDelete={() => setBulkDeleteDialogOpen(true)}
          entityName="prohlídek"
        />
      )}

      <Card className="p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {canBulkActions && archiveFilter !== "active" && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectableItems.length > 0 && selectedIds.length === selectableItems.length}
                      onCheckedChange={handleSelectAll}
                      aria-label="Vybrat vše"
                    />
                  </TableHead>
                )}
                <TableHead>Datum</TableHead>
                <TableHead>Typ prohlídky</TableHead>
                <TableHead>Os. číslo</TableHead>
                <TableHead>Jméno</TableHead>
                <TableHead>Stav zaměstnance</TableHead>
                <TableHead>Středisko</TableHead>
                <TableHead>Lékař</TableHead>
                <TableHead>Zdravotnické zařízení</TableHead>
                <TableHead>Výsledek</TableHead>
                <TableHead>Poznámka</TableHead>
                {(archiveFilter === "all" || archiveFilter === "archived") && (
                  <TableHead>Stav</TableHead>
                )}
                {canEdit && <TableHead>Akce</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                    Žádná historie nenalezena
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory.map((exam) => (
                  <TableRow key={exam.id} className={exam.isArchived ? "bg-muted/50" : ""}>
                    {canBulkActions && archiveFilter !== "active" && (
                      <TableCell>
                        {exam.isArchived && (
                          <Checkbox
                            checked={selectedIds.includes(exam.id)}
                            onCheckedChange={() => handleSelectItem(exam.id)}
                          />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap">
                      {new Date(exam.date).toLocaleDateString("cs-CZ")}
                    </TableCell>
                    <TableCell className="font-medium">{exam.type}</TableCell>
                    <TableCell>{exam.employeeNumber}</TableCell>
                    <TableCell className="whitespace-nowrap">{exam.employeeName}</TableCell>
                    <TableCell>
                      <Badge className={employeeStatusColors[exam.employeeStatus]}>
                        {employeeStatusLabels[exam.employeeStatus] || exam.employeeStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{exam.department}</TableCell>
                    <TableCell>{exam.doctor || "-"}</TableCell>
                    <TableCell>{exam.medicalFacility || "-"}</TableCell>
                    <TableCell>{exam.result || "-"}</TableCell>
                    <TableCell>{exam.note || "-"}</TableCell>
                    {(archiveFilter === "all" || archiveFilter === "archived") && (
                      <TableCell>
                        {exam.isArchived ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            <Archive className="w-3 h-3 mr-1" />
                            Archivováno
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Aktivní
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          {exam.isArchived ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestore(exam.id)}
                              disabled={restoringId === exam.id}
                            >
                              {restoringId === exam.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <ArchiveRestore className="w-4 h-4 mr-1" />
                                  Obnovit
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleArchive(exam.id)}
                              disabled={archivingId === exam.id}
                            >
                              {archivingId === exam.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Archive className="w-4 h-4 mr-1" />
                                  Archivovat
                                </>
                              )}
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmId(exam.id)}
                              disabled={deletingId === exam.id}
                            >
                              {deletingId === exam.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="font-medium">Stav zaměstnance:</span>
        {Object.entries(employeeStatusLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={`inline-block w-3 h-3 rounded-full ${employeeStatusColors[key]}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <BulkArchiveDialog
        open={bulkRestoreDialogOpen}
        onOpenChange={setBulkRestoreDialogOpen}
        selectedCount={selectedIds.length}
        onConfirm={handleBulkRestore}
        loading={bulkActionLoading}
        mode="restore"
        entityName="prohlídek"
      />

      <BulkArchiveDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        selectedCount={selectedIds.length}
        onConfirm={handleBulkDelete}
        loading={bulkActionLoading}
        mode="delete"
        entityName="prohlídek"
      />

      {/* Single delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trvale smazat prohlídku?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Prohlídka a všechny související dokumenty budou trvale odstraněny.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
