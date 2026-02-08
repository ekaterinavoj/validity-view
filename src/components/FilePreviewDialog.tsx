import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | { name: string; url: string; type: string } | null;
  onDownload?: () => void;
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  file,
  onDownload,
}: FilePreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize file properties to avoid recalculating
  const { fileName, fileType, isPDF, isImage } = useMemo(() => {
    if (!file) {
      return { fileName: "", fileType: "", isPDF: false, isImage: false };
    }
    
    const name = file.name || "";
    const type = file instanceof File ? file.type : (file as { type: string })?.type || "";
    
    return {
      fileName: name,
      fileType: type,
      isPDF: type === "application/pdf" || name.toLowerCase().endsWith(".pdf"),
      isImage: type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name),
    };
  }, [file]);

  // Update preview URL when file changes or dialog opens
  useEffect(() => {
    // Reset state when dialog closes
    if (!open) {
      return;
    }

    // No file provided
    if (!file) {
      setPreviewUrl("");
      setLoading(false);
      setError("Soubor není k dispozici");
      return;
    }

    setLoading(true);
    setError(null);

    if (file instanceof File) {
      // For File objects, create object URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setLoading(false);
      
      // Cleanup on unmount or when file changes
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      // For remote URLs, use them directly
      const url = (file as { url: string }).url;
      if (url) {
        setPreviewUrl(url);
        setLoading(false);
      } else {
        setPreviewUrl("");
        setError("URL není k dispozici");
        setLoading(false);
      }
    }
  }, [file, open]);

  const handleClose = () => {
    setError(null);
    onOpenChange(false);
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else if (previewUrl) {
      // Fallback: open URL in new tab for download
      window.open(previewUrl, "_blank");
    }
  };

  // Don't render content if no file
  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate pr-4">
              {fileName || "Dokument"}
            </DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleDownload}
                title="Stáhnout"
                disabled={!previewUrl}
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                title="Zavřít"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-[70vh]">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[70vh]">
              <div className="text-center space-y-4">
                <p className="text-destructive">{error}</p>
                {previewUrl && (
                  <Button onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Stáhnout soubor
                  </Button>
                )}
              </div>
            </div>
          ) : isPDF ? (
            <iframe
              src={previewUrl}
              className="w-full h-[70vh] border-0 rounded"
              title={fileName}
            />
          ) : isImage ? (
            <div className="flex items-center justify-center">
              <img
                src={previewUrl}
                alt={fileName}
                className="max-w-full max-h-[70vh] object-contain rounded"
                onError={() => setError("Nepodařilo se načíst obrázek")}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[70vh]">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Náhled není k dispozici pro tento typ souboru.
                </p>
                {previewUrl && (
                  <Button onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Stáhnout soubor
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
