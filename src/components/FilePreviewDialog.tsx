import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useState } from "react";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | { name: string; url: string; type: string };
  onDownload?: () => void;
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  file,
  onDownload,
}: FilePreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string>(() => {
    if (file instanceof File) {
      return URL.createObjectURL(file);
    }
    return (file as { url: string }).url;
  });

  const fileName = file.name;
  const fileType = file instanceof File ? file.type : (file as { type: string }).type;
  
  const isPDF = fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  const isImage = fileType.startsWith("image/") || 
    /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);

  const handleClose = () => {
    if (file instanceof File) {
      URL.revokeObjectURL(previewUrl);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate pr-4">
              {fileName}
            </DialogTitle>
            <div className="flex gap-2">
              {onDownload && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onDownload}
                  title="Stáhnout"
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
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
          {isPDF ? (
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
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[70vh]">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Náhled není k dispozici pro tento typ souboru.
                </p>
                {onDownload && (
                  <Button onClick={onDownload}>
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
