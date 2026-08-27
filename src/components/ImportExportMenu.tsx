import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDownUp, Download, FileDown, Upload } from "lucide-react";

interface ImportExportMenuProps {
  onExport: () => void;
  /** Shown as "Exportovat CSV (N)" when > 0 — e.g. a selection count. */
  exportCount?: number;
  /** Omit to hide the import option entirely (e.g. user lacks permission to import). */
  onToggleImport?: () => void;
  /** Omit to hide the "download blank template" option — only some modules offer one. */
  onDownloadTemplate?: () => void;
  disabled?: boolean;
}

/**
 * Single "Import / Export" menu replacing two separate buttons — they're two
 * sides of the same CSV workflow and don't need a permanent slot each.
 */
export function ImportExportMenu({ onExport, exportCount, onToggleImport, onDownloadTemplate, disabled }: ImportExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <ArrowDownUp className="w-4 h-4 mr-2" />
          Import / Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExport}>
          <Download className="w-4 h-4 mr-2" />
          {exportCount && exportCount > 0 ? `Exportovat CSV (${exportCount})` : "Exportovat CSV"}
        </DropdownMenuItem>
        {onToggleImport && (
          <DropdownMenuItem onClick={onToggleImport}>
            <Upload className="w-4 h-4 mr-2" />
            Importovat ze souboru
          </DropdownMenuItem>
        )}
        {onDownloadTemplate && (
          <DropdownMenuItem onClick={onDownloadTemplate}>
            <FileDown className="w-4 h-4 mr-2" />
            Stáhnout šablonu pro import
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
