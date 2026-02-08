import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Edit, Archive, Trash2, X } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkEdit?: () => void;
  onBulkArchive?: () => void;
  onBulkDelete?: () => void;
  entityName?: string;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkEdit,
  onBulkArchive,
  onBulkDelete,
  entityName = "záznamů",
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
          {onBulkArchive && (
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
