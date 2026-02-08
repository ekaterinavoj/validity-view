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
    if (!open) return;

    if (!file) {
      setPreviewUrl("");
      setLoading(false);
      setError("Soubor není k dispozici");
      return;
    }

    setLoading(true);
    setError(null);

    // Local file (selected/uploaded in browser)
    if (file instanceof File) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setLoading(false);

      return () => {
        URL.revokeObjectURL(url);
      };
    }

    const remoteUrl = (file as { url: string }).url;
    if (!remoteUrl) {
      setPreviewUrl("");
      setError("URL není k dispozici");
      setLoading(false);
      return;
    }

    // PDFs: load as Blob -> blob: URL.
    // This avoids Chrome/extensions blocking embedded cross-origin PDF viewers.
    if (isPDF) {
      let blobUrl: string | null = null;
      const controller = new AbortController();

      (async () => {
        try {
          const res = await fetch(remoteUrl, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          blobUrl = URL.createObjectURL(blob);
          setPreviewUrl(blobUrl);
        } catch (e: any) {
          if (e?.name === "AbortError") return;
          // Fallback: keep original URL for at least download attempt
          setPreviewUrl(remoteUrl);
          setError("Náhled PDF se nepodařilo načíst — použijte Stažení.");
        } finally {
          setLoading(false);
        }
      })();

      return () => {
        controller.abort();
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      };
    }

    // Images/other: use remote URL directly
    setPreviewUrl(remoteUrl);
    setLoading(false);
  }, [file, open, isPDF]);

  const handleClose = () => {
    setError(null);
    onOpenChange(false);
  };

  const triggerBrowserDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name || "soubor";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }

    if (!file) return;

    try {
      setError(null);
      setLoading(true);

      if (file instanceof File) {
        const url = URL.createObjectURL(file);
        triggerBrowserDownload(url, file.name);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }

      const remoteUrl = (file as { url: string }).url;
      if (!remoteUrl) {
        setError("URL není k dispozici");
        return;
      }

      const res = await fetch(remoteUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      triggerBrowserDownload(blobUrl, fileName || "soubor");
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e: any) {
      setError(`Stažení selhalo: ${e?.message ?? "Neznámá chyba"}`);
    } finally {
      setLoading(false);
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
                disabled={!file}
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
            <object
              data={previewUrl}
              type="application/pdf"
              className="w-full h-[70vh] border-0 rounded"
            >
              {/* Fallback pro prohlížeče, které blokují PDF v object tagu */}
              <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
                <p className="text-muted-foreground text-center">
                  Náhled PDF není v tomto prohlížeči k dispozici.
                </p>
                <div className="flex justify-center">
                  <Button onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Stáhnout PDF
                  </Button>
                </div>
              </div>
            </object>
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
