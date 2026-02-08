import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, File, Download, Trash2, Loader2, Eye } from "lucide-react";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { useToast } from "@/hooks/use-toast";
import {
  DeadlineDocument,
  getDeadlineDocuments,
  deleteDeadlineDocument,
  getDeadlineDocumentDownloadUrl,
  formatFileSize,
  DEADLINE_DOCUMENT_TYPE_LABELS,
} from "@/lib/deadlineDocuments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeadlineDocumentsListProps {
  deadlineId: string;
  canDelete?: boolean;
  onDocumentDeleted?: () => void;
}

export function DeadlineDocumentsList({
  deadlineId,
  canDelete = false,
  onDocumentDeleted,
}: DeadlineDocumentsListProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DeadlineDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewFiles, setPreviewFiles] = useState<{ name: string; url: string; type: string }[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const loadDocuments = async () => {
    setLoading(true);
    const { data, error } = await getDeadlineDocuments(deadlineId);
    if (error) {
      toast({
        title: "Chyba při načítání dokumentů",
        description: error.message,
        variant: "destructive",
      });
    } else if (data) {
      setDocuments(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDocuments();
  }, [deadlineId]);

  const handleDownload = async (document: DeadlineDocument) => {
    const { url, error } = await getDeadlineDocumentDownloadUrl(document.file_path);
    if (error) {
      toast({
        title: "Chyba při stahování",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (url) {
      window.open(url, "_blank");
    }
  };

  // Preview all documents
  const handlePreviewSingle = async (document: DeadlineDocument) => {
    // Load all documents for preview
    const files: { name: string; url: string; type: string }[] = [];
    
    for (const doc of documents) {
      const { url, error } = await getDeadlineDocumentDownloadUrl(doc.file_path);
      if (!error && url) {
        files.push({
          name: doc.file_name,
          url,
          type: doc.file_type,
        });
      }
    }
    
    if (files.length > 0) {
      setPreviewFiles(files);
      setShowPreview(true);
    }
  };

  const handleDelete = async (document: DeadlineDocument) => {
    setDeletingId(document.id);
    const { error } = await deleteDeadlineDocument(document.id, document.file_path);
    
    if (error) {
      toast({
        title: "Chyba při mazání",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Dokument smazán",
        description: "Dokument byl úspěšně odstraněn.",
      });
      setDocuments((prev) => prev.filter((d) => d.id !== document.id));
      onDocumentDeleted?.();
    }
    setDeletingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground text-center">
          Žádné dokumenty nebyly nahrány
        </p>
      </Card>
    );
  }

  return (
    <>
      <FilePreviewDialog
        open={showPreview}
        onOpenChange={(open) => !open && setShowPreview(false)}
        file={null}
        files={previewFiles}
      />
      
      <div className="space-y-3">
        {documents.map((document) => (
        <Card key={document.id} className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-accent rounded">
              {document.file_type.includes("pdf") ? (
                <FileText className="w-5 h-5 text-primary" />
              ) : (
                <File className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{document.file_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {DEADLINE_DOCUMENT_TYPE_LABELS[document.document_type as keyof typeof DEADLINE_DOCUMENT_TYPE_LABELS] || document.document_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(document.file_size)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(document.uploaded_at).toLocaleDateString("cs-CZ")}
                    </span>
                  </div>
                  {document.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {document.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePreviewSingle(document)}
                    title="Náhled"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(document)}
                    title="Stáhnout"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === document.id}
                          title="Smazat"
                        >
                          {deletingId === document.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Smazat dokument?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Opravdu chcete smazat dokument "{document.file_name}"? Tato akce
                            je nevratná.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Zrušit</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(document)}>
                            Smazat
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
        ))}
      </div>
    </>
  );
}
