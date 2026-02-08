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
import { supabase } from "@/integrations/supabase/client";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";

interface MedicalDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  document_type: string;
  uploaded_at: string;
}

interface MedicalProtocolCellProps {
  examinationId: string;
}

export function MedicalProtocolCell({ examinationId }: MedicalProtocolCellProps) {
  const { toast } = useToast();
  const [latestDocument, setLatestDocument] = useState<MedicalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string; fileType: string } | null>(null);

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("medical_examination_documents")
        .select("id, file_name, file_path, file_type, document_type, uploaded_at")
        .eq("examination_id", examinationId)
        .order("uploaded_at", { ascending: false });

      if (!error && data && data.length > 0) {
        // Get the most recent document (protocol or certificate preferred)
        // Priority: protocol > certificate > any other
        const priorityOrder = ["protocol", "certificate", "medical_report", "other"];
        
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
  }, [examinationId]);

  const handlePreview = async () => {
    if (!latestDocument) return;
    
    try {
      const { data, error } = await supabase.storage
        .from("medical-documents")
        .createSignedUrl(latestDocument.file_path, 3600);

      if (error) throw error;
      
      if (data?.signedUrl) {
        setPreviewDoc({
          url: data.signedUrl,
          fileName: latestDocument.file_name,
          fileType: latestDocument.file_type,
        });
      }
    } catch (err: any) {
      toast({
        title: "Chyba při načítání dokumentu",
        description: err.message,
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

  if (!latestDocument) {
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
              className="h-8 w-8"
              onClick={handlePreview}
            >
              <FileText className="w-4 h-4 text-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{latestDocument.file_name}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <FilePreviewDialog
        open={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        file={previewDoc ? { name: previewDoc.fileName, url: previewDoc.url, type: previewDoc.fileType } : null}
      />
    </>
  );
}
