import { Loader2, Archive, Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BulkArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: () => void;
  loading: boolean;
  entityName?: string;
  mode?: "archive" | "delete";
}

export function BulkArchiveDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  loading,
  entityName = "záznamů",
  mode = "archive",
}: BulkArchiveDialogProps) {
  const isDelete = mode === "delete";
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isDelete ? (
              <>
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Trvale smazat vybrané záznamy?
              </>
            ) : (
              <>
                <Archive className="w-5 h-5 text-muted-foreground" />
                Archivovat vybrané záznamy?
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              {isDelete ? (
                <>
                  Bude <span className="font-semibold text-destructive">trvale smazáno</span> {selectedCount} {entityName}.
                  <br />
                  <span className="text-destructive font-medium">Tato akce je nevratná!</span>
                </>
              ) : (
                <>
                  Bude archivováno {selectedCount} {entityName}.
                  <br />
                  Archivované záznamy budou dostupné v historii a lze je obnovit.
                </>
              )}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Zrušit</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className={isDelete 
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
              : ""
            }
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isDelete ? (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Trvale smazat
              </>
            ) : (
              <>
                <Archive className="w-4 h-4 mr-2" />
                Archivovat
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
