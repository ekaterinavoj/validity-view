import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Edit, Archive, Trash2, X, ArchiveRestore } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkEdit?: () => void;
  onBulkArchive?: () => void;
  onBulkDelete?: () => void;
  onBulkRestore?: () => void;
  entityName?: string;
  /** Use in history pages to show "Obnovit" instead of "Archivovat" */
  showRestoreInsteadOfArchive?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkEdit,
  onBulkArchive,
  onBulkDelete,
  onBulkRestore,
  entityName = "záznamů",
  showRestoreInsteadOfArchive = false,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <Card className="p-4 bg-primary/5 border-primary/20">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-sm font-medium">
            Vybráno <span className="font-bold text-primary">{selectedCount}</span> {entityName}
          </p>
          <Button variant="ghost" size="sm" onClick={onClearSelection} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4 mr-1" />
            Zrušit výběr
          </Button>
        </div>
        <div className="flex gap-2">
          {onBulkEdit && (
            <Button variant="default" size="sm" onClick={onBulkEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Hromadná úprava
            </Button>
          )}
          {onBulkRestore && (
            <Button variant="outline" size="sm" onClick={onBulkRestore}>
              <ArchiveRestore className="w-4 h-4 mr-2" />
              Obnovit
            </Button>
          )}
          {onBulkArchive && !showRestoreInsteadOfArchive && (
            <Button variant="outline" size="sm" onClick={onBulkArchive}>
              <Archive className="w-4 h-4 mr-2" />
              Archivovat
            </Button>
          )}
          {onBulkDelete && (
            <Button variant="destructive" size="sm" onClick={onBulkDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Smazat
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}