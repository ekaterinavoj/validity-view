import { useState, useEffect } from "react";
import { FileText, File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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

interface TrainingProtocolCellProps {
  trainingId: string;
}

export function TrainingProtocolCell({ trainingId }: TrainingProtocolCellProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<TrainingDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      const { data, error } = await getTrainingDocuments(trainingId);
      if (!error && data) {
        // Filter only protocol documents
        const protocols = data.filter((d) => d.document_type === "protocol");
        setDocuments(protocols);
      }
      setLoading(false);
    };

    loadDocuments();
  }, [trainingId]);

  const handleDownload = async (document: TrainingDocument) => {
    const { url, error } = await getDocumentDownloadUrl(document.file_path);
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
    <div className="flex gap-1">
      {documents.map((document) => (
        <TooltipProvider key={document.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleDownload(document)}
              >
                {document.file_type.includes("pdf") ? (
                  <FileText className="w-4 h-4 text-primary" />
                ) : (
                  <File className="w-4 h-4 text-primary" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{document.file_name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
