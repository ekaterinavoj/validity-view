import { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
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
  const [latestDocument, setLatestDocument] = useState<TrainingDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      const { data, error } = await getTrainingDocuments(trainingId);
      if (!error && data && data.length > 0) {
        // Get the most recent document (protocol or certificate preferred)
        // Priority: protocol > certificate > any other
        const priorityOrder = ["protocol", "certificate", "attendance_sheet", "other"];
        
        // Sort by priority, then by upload date (newest first)
        const sorted = [...data].sort((a, b) => {
          const priorityA = priorityOrder.indexOf(a.document_type);
          const priorityB = priorityOrder.indexOf(b.document_type);
          
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          
          // Same priority - sort by date (newest first)
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
        });
        
        setLatestDocument(sorted[0] || null);
      } else {
        setLatestDocument(null);
      }
      setLoading(false);
    };

    loadDocuments();
  }, [trainingId]);

  const handleDownload = async () => {
    if (!latestDocument) return;
    
    const { url, error } = await getDocumentDownloadUrl(latestDocument.file_path);
    if (error) {
      toast({
        title: "Chyba při stahování",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (url) {
      // Try to open in a new tab first
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");
      
      // If popup was blocked or failed, try fallback download via fetch → blob
      if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error("Failed to fetch file");
          }
          
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = latestDocument.file_name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Cleanup blob URL after download
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
          
          toast({
            title: "Soubor stažen",
            description: `Protokol "${latestDocument.file_name}" byl stažen.`,
          });
        } catch (fetchError) {
          toast({
            title: "Chyba při stahování",
            description: "Nelze stáhnout soubor. Zkuste to prosím znovu.",
            variant: "destructive",
          });
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!latestDocument) {
    return (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
          >
            <FileText className="w-4 h-4 text-primary" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{latestDocument.file_name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
