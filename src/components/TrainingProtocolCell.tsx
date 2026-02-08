import { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrainingDocument,
  getTrainingDocuments,
  getDocumentDownloadUrl,
} from "@/lib/trainingDocuments";
import { FilePreviewDialog, PreviewFile } from "@/components/FilePreviewDialog";

interface TrainingProtocolCellProps {
  trainingId: string;
}

export function TrainingProtocolCell({ trainingId }: TrainingProtocolCellProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<TrainingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      const { data, error } = await getTrainingDocuments(trainingId);
      if (!error && data && data.length > 0) {
        setDocuments(data);
      } else {
        setDocuments([]);
      }
      setLoading(false);
    };

    loadDocuments();
  }, [trainingId]);

  const handlePreview = async () => {
    if (documents.length === 0) return;
    
    // Load all document URLs
    const files: PreviewFile[] = [];
    
    for (const doc of documents) {
      const { url, error } = await getDocumentDownloadUrl(doc.file_path);
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
    } else {
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst dokumenty.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 relative"
              onClick={handlePreview}
            >
              <FileText className="w-4 h-4 text-primary" />
              {documents.length > 1 && (
                <Badge 
                  variant="secondary" 
                  className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
                >
                  {documents.length}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              {documents.length === 1 
                ? documents[0].file_name 
                : `${documents.length} dokumentů`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <FilePreviewDialog
        open={showPreview}
        onOpenChange={(open) => !open && setShowPreview(false)}
        file={null}
        files={previewFiles}
      />
    </>
  );
}
