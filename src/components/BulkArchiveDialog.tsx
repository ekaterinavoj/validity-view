import { Loader2, Archive, Trash2, AlertTriangle, ArchiveRestore } from "lucide-react";
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
  loading?: boolean;
  isLoading?: boolean;
  entityName?: string;
  mode?: "archive" | "delete" | "restore";
}

export function BulkArchiveDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  loading,
  isLoading,
  entityName = "záznamů",
  mode = "archive",
}: BulkArchiveDialogProps) {
  const isDelete = mode === "delete";
  const isRestore = mode === "restore";
  const isLoadingState = loading ?? isLoading ?? false;
  
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
            ) : isRestore ? (
              <>
                <ArchiveRestore className="w-5 h-5 text-primary" />
                Obnovit vybrané záznamy?
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
              ) : isRestore ? (
                <>
                  Bude obnoveno {selectedCount} {entityName}.
                  <br />
                  Záznamy budou přesunuty zpět mezi aktivní.
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
          <AlertDialogCancel disabled={isLoadingState}>Zrušit</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoadingState}
            className={isDelete 
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
              : ""
            }
          >
            {isLoadingState && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isDelete ? (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Trvale smazat
              </>
            ) : isRestore ? (
              <>
                <ArchiveRestore className="w-4 h-4 mr-2" />
                Obnovit
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