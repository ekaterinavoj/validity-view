import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Edit, Archive, X } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkEdit?: () => void;
  onBulkArchive?: () => void;
  entityName?: string;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkEdit,
  onBulkArchive,
  entityName = "záznamů",
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <Card className="p-4 bg-primary/5 border-primary/20">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <p className="text-sm font-medium">
            Vybráno {selectedCount} {entityName}
          </p>
          <Button variant="outline" size="sm" onClick={onClearSelection}>
            <X className="w-4 h-4 mr-2" />
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
            <Button variant="destructive" size="sm" onClick={onBulkArchive}>
              <Archive className="w-4 h-4 mr-2" />
              Archivovat
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
