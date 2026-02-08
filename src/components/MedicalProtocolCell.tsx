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
import { supabase } from "@/integrations/supabase/client";
import { FilePreviewDialog, PreviewFile } from "@/components/FilePreviewDialog";

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
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("medical_examination_documents")
        .select("id, file_name, file_path, file_type, document_type, uploaded_at")
        .eq("examination_id", examinationId)
        .order("uploaded_at", { ascending: false });

      if (!error && data && data.length > 0) {
        setDocuments(data);
      } else {
        setDocuments([]);
      }
      setLoading(false);
    };

    loadDocuments();
  }, [examinationId]);

  const handlePreview = async () => {
    if (documents.length === 0) return;
    
    try {
      // Load all document URLs
      const files: PreviewFile[] = [];
      
      for (const doc of documents) {
        const { data, error } = await supabase.storage
          .from("medical-documents")
          .createSignedUrl(doc.file_path, 3600);

        if (!error && data?.signedUrl) {
          files.push({
            name: doc.file_name,
            url: data.signedUrl,
            type: doc.file_type,
          });
        }
      }

      if (files.length > 0) {
        setPreviewFiles(files);
        setShowPreview(true);
      } else {
        throw new Error("Nepodařilo se načíst dokumenty");
      }
    } catch (err: any) {
      toast({
        title: "Chyba při načítání dokumentů",
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
