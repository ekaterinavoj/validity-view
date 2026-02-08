import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Layers, FileText } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useUserPreferences } from "@/hooks/useUserPreferences";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | { name: string; url: string; type: string } | null;
  onDownload?: () => void;
}

type ViewMode = "single" | "scroll";

export function FilePreviewDialog({
  open,
  onOpenChange,
  file,
  onDownload,
}: FilePreviewDialogProps) {
  const { preferences, updatePreference } = useUserPreferences();
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // PDF viewer state
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pdfError, setPdfError] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>(preferences.pdfViewMode || "scroll");

  // Sync viewMode with user preference
  useEffect(() => {
    if (preferences.pdfViewMode) {
      setViewMode(preferences.pdfViewMode);
    }
  }, [preferences.pdfViewMode]);

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

  // Reset PDF state when dialog opens/closes or file changes
  useEffect(() => {
    if (open) {
      setPageNumber(1);
      setScale(1.0);
      setNumPages(0);
      setPdfError(false);
      // Use stored preference
      setViewMode(preferences.pdfViewMode || "scroll");
    }
  }, [open, file, preferences.pdfViewMode]);

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

  // PDF navigation handlers
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setPdfError(true);
  }, []);

  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages));
  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));

  // Handle view mode change and save preference
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    updatePreference("pdfViewMode", mode);
  };

  // Generate array of page numbers for scroll mode
  const pageNumbers = useMemo(() => {
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }, [numPages]);

  // Don't render content if no file
  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-lg font-semibold truncate pr-4">
              {fileName || "Dokument"}
            </DialogTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={handleDownload}
              title="Stáhnout"
              disabled={!file}
            >
              <Download className="w-4 h-4" />
            </Button>
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
                <Button onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Stáhnout soubor
                </Button>
              </div>
            </div>
          ) : isPDF ? (
            <div className="flex flex-col items-center">
              {/* PDF Controls */}
              {numPages > 0 && !pdfError && (
                <div className="flex items-center gap-4 mb-4 p-2 bg-muted rounded-lg flex-wrap justify-center">
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant={viewMode === "single" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => handleViewModeChange("single")}
                      title="Jedna stránka"
                      className="gap-1"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline text-xs">Jedna</span>
                    </Button>
                    <Button
                      variant={viewMode === "scroll" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => handleViewModeChange("scroll")}
                      title="Všechny stránky"
                      className="gap-1"
                    >
                      <Layers className="w-4 h-4" />
                      <span className="hidden sm:inline text-xs">Vše</span>
                    </Button>
                  </div>

                  <div className="w-px h-6 bg-border" />

                  {/* Page Navigation (only in single mode) */}
                  {viewMode === "single" && (
                    <>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={goToPrevPage}
                          disabled={pageNumber <= 1}
                          title="Předchozí strana"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm min-w-[80px] text-center">
                          {pageNumber} / {numPages}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={goToNextPage}
                          disabled={pageNumber >= numPages}
                          title="Další strana"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="w-px h-6 bg-border" />
                    </>
                  )}

                  {/* Page count indicator in scroll mode */}
                  {viewMode === "scroll" && (
                    <>
                      <span className="text-sm text-muted-foreground">
                        {numPages} {numPages === 1 ? "stránka" : numPages < 5 ? "stránky" : "stránek"}
                      </span>
                      <div className="w-px h-6 bg-border" />
                    </>
                  )}

                  {/* Zoom Controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={zoomOut}
                      disabled={scale <= 0.5}
                      title="Oddálit"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-sm min-w-[50px] text-center">
                      {Math.round(scale * 100)}%
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={zoomIn}
                      disabled={scale >= 3.0}
                      title="Přiblížit"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* PDF Document */}
              <div className="overflow-auto max-h-[60vh] border rounded-lg bg-muted p-4 w-full">
                <Document
                  file={previewUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="flex items-center justify-center h-[50vh]">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                      <p className="text-muted-foreground text-center">
                        Náhled PDF se nepodařilo načíst.
                      </p>
                      <Button onClick={handleDownload}>
                        <Download className="w-4 h-4 mr-2" />
                        Stáhnout PDF
                      </Button>
                    </div>
                  }
                >
                  {viewMode === "single" ? (
                    <div className="flex justify-center">
                      <Page 
                        pageNumber={pageNumber} 
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      {pageNumbers.map((page) => (
                        <div key={page} className="relative">
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-background/80 px-2 py-0.5 rounded text-xs text-muted-foreground z-10">
                            {page} / {numPages}
                          </div>
                          <Page 
                            pageNumber={page} 
                            scale={scale}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Document>
              </div>
            </div>
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
