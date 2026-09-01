import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Layers, FileText, File, List, Table as TableIcon } from "lucide-react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import * as XLSX from "xlsx";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Set up PDF.js worker - use local worker bundled with the app (works offline/Docker without CDN)
// The worker file is copied to public/pdf-worker/ during build via vite config
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export interface PreviewFile {
  name: string;
  url: string;
  type: string;
}

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | PreviewFile | null;
  files?: PreviewFile[]; // Multiple files support
  onDownload?: () => void;
}

type ViewMode = "single" | "scroll";

// Single PDF Viewer Component
function PDFViewer({
  url,
  originalUrl,
  fileName,
  scale,
  viewMode,
  showHeader = false,
}: {
  url: string;
  /** The raw remote (signed) URL, even when `url` is a blob: object URL — used as a
   *  fallback the browser can navigate to directly when the in-app preview fails
   *  (e.g. the storage response lacks CORS headers, which blocks pdf.js's fetch
   *  but not a plain link/tab navigation). */
  originalUrl?: string;
  fileName: string;
  scale: number;
  viewMode: ViewMode;
  showHeader?: boolean;
  onFirstPageMeta?: (meta: { width: number; height: number }) => void;
}) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfError, setPdfError] = useState<boolean>(false);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(false);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    // Log so the actual cause (most often a CORS-blocked fetch of the storage
    // signed URL) is visible in devtools instead of just the generic message below.
    console.error("Náhled PDF se nepodařilo načíst:", fileName, err);
    setPdfError(true);
  }, [fileName]);

  const handlePageLoadSuccess = useCallback(
    (page: any) => {
      // Native page units (PDF points). Pass to parent only on first page.
      if (page?.pageNumber === 1 && onFirstPageMeta) {
        const viewport = page.getViewport({ scale: 1 });
        onFirstPageMeta({ width: viewport.width, height: viewport.height });
      }
    },
    [onFirstPageMeta],
  );

  const pageNumbers = useMemo(() => {
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }, [numPages]);

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center gap-2 px-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium truncate">{fileName}</span>
          {numPages > 0 && (
            <Badge variant="secondary" className="text-xs ml-auto">
              {numPages} {numPages === 1 ? "stránka" : numPages < 5 ? "stránky" : "stránek"}
            </Badge>
          )}
        </div>
      )}
      <Document
        file={url}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        }
        error={
          <div className="flex flex-col items-center justify-center h-32 space-y-2">
            <p className="text-muted-foreground text-sm text-center">
              Náhled PDF se nepodařilo načíst v aplikaci.
            </p>
            {originalUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={originalUrl} target="_blank" rel="noopener noreferrer">
                  Otevřít soubor v novém okně
                </a>
              </Button>
            )}
          </div>
        }
      >
        {viewMode === "single" ? (
          <div className="flex flex-col items-center gap-2">
            <Page 
              pageNumber={pageNumber} 
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              onLoadSuccess={handlePageLoadSuccess}
            />
            {numPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
                  disabled={pageNumber <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  {pageNumber} / {numPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPageNumber((prev) => Math.min(prev + 1, numPages))}
                  disabled={pageNumber >= numPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
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
                  onLoadSuccess={page === 1 ? handlePageLoadSuccess : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </Document>
    </div>
  );
}

// Single Image Viewer Component
function ImageViewer({
  url,
  fileName,
  scale = 1,
  showHeader = false,
  onMeta,
}: {
  url: string;
  fileName: string;
  scale?: number;
  showHeader?: boolean;
  onMeta?: (meta: { width: number; height: number }) => void;
}) {
  const [error, setError] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  if (error) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-muted-foreground text-sm">Nepodařilo se načíst obrázek</p>
      </div>
    );
  }

  const imgStyle: React.CSSProperties = naturalSize
    ? {
        width: `${naturalSize.width * scale}px`,
        height: `${naturalSize.height * scale}px`,
        maxWidth: "none",
      }
    : { maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" };

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center gap-2 px-2">
          <File className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium truncate">{fileName}</span>
        </div>
      )}
      <div className="flex justify-center">
        <img
          src={url}
          alt={fileName}
          style={imgStyle}
          className="rounded"
          onError={() => setError(true)}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
            onMeta?.({ width: img.naturalWidth, height: img.naturalHeight });
          }}
        />
      </div>
    </div>
  );
}

// Single Excel (XLS/XLSX) Viewer Component — renders sheets as HTML tables using
// the `xlsx` (SheetJS) library already used elsewhere in the app for import/export.
function ExcelViewer({ url, fileName, showHeader = false }: { url: string; fileName: string; showHeader?: boolean }) {
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [tableHtml, setTableHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const workbookRef = useRef<XLSX.WorkBook | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        if (cancelled) return;
        workbookRef.current = workbook;
        setSheetNames(workbook.SheetNames);
        setActiveSheet(workbook.SheetNames[0] || "");
      } catch (err) {
        console.error("Náhled Excel souboru se nepodařilo načíst:", fileName, err);
        if (!cancelled) setError("Náhled se nepodařilo načíst.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, fileName]);

  useEffect(() => {
    if (!activeSheet || !workbookRef.current) return;
    const sheet = workbookRef.current.Sheets[activeSheet];
    if (!sheet) return;
    setTableHtml(XLSX.utils.sheet_to_html(sheet, { editable: false }));
  }, [activeSheet]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center gap-2 px-2">
          <TableIcon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium truncate">{fileName}</span>
        </div>
      )}
      {sheetNames.length > 1 && (
        <div className="flex flex-wrap gap-1 px-1">
          {sheetNames.map((name) => (
            <Button
              key={name}
              type="button"
              size="sm"
              variant={name === activeSheet ? "secondary" : "outline"}
              onClick={() => setActiveSheet(name)}
            >
              {name}
            </Button>
          ))}
        </div>
      )}
      <div
        className="overflow-auto max-h-[600px] rounded border bg-background [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:text-sm [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-sm [&_th]:bg-muted"
        dangerouslySetInnerHTML={{ __html: tableHtml }}
      />
    </div>
  );
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  file,
  files,
  onDownload,
}: FilePreviewDialogProps) {
  const { preferences, updatePreference } = useUserPreferences();
  const [loadedUrls, setLoadedUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [autoFit, setAutoFit] = useState<boolean>(true); // fit-to-page mode (default ON)
  const [viewMode, setViewMode] = useState<ViewMode>(preferences.pdfViewMode || "scroll");
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  // Native dimensions of currently shown media – used to adapt dialog size.
  const [mediaMeta, setMediaMeta] = useState<{ width: number; height: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Determine files to show
  const allFiles = useMemo(() => {
    if (files && files.length > 0) {
      return files;
    }
    if (file) {
      if (file instanceof File) {
        return [{ name: file.name, url: "", type: file.type, localFile: file }] as (PreviewFile & { localFile?: File })[];
      }
      return [file as PreviewFile];
    }
    return [];
  }, [file, files]);

  // Check if we have any PDFs
  const hasPDFs = useMemo(() => {
    return allFiles.some(f => 
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
  }, [allFiles]);

  const hasImages = useMemo(() => {
    return allFiles.some(f =>
      f.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f.name)
    );
  }, [allFiles]);

  const hasZoomable = hasPDFs || hasImages;
  const showMultipleFiles = allFiles.length > 1;

  // Sync viewMode with user preference
  useEffect(() => {
    if (preferences.pdfViewMode) {
      setViewMode(preferences.pdfViewMode);
    }
  }, [preferences.pdfViewMode]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setScale(1.0);
      setAutoFit(true);
      setError(null);
      setCurrentDocIndex(0);
      setViewMode(preferences.pdfViewMode || "scroll");
      setMediaMeta(null);
    }
  }, [open, preferences.pdfViewMode]);

  // Reset measured size whenever the user switches between files
  useEffect(() => {
    setMediaMeta(null);
  }, [currentDocIndex]);

  // Load URLs for all files
  useEffect(() => {
    if (!open || allFiles.length === 0) return;

    let blobUrls: string[] = [];

    const loadUrls = async () => {
      setLoading(true);
      setError(null);

      // Load all URLs in parallel using Promise.all
      const entries = await Promise.all(
        allFiles.map(async (f): Promise<[string, string] | null> => {
          const fileKey = f.name + (f.url || "");

          // Handle local File objects
          if ((f as any).localFile) {
            const objUrl = URL.createObjectURL((f as any).localFile);
            blobUrls.push(objUrl);
            return [fileKey, objUrl];
          }

          const remoteUrl = f.url;
          if (!remoteUrl) return null;

          const isPDF = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

          if (isPDF) {
            try {
              const res = await fetch(remoteUrl);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const blob = await res.blob();
              const objUrl = URL.createObjectURL(blob);
              blobUrls.push(objUrl);
              return [fileKey, objUrl];
            } catch (err) {
              // Most often a CORS-blocked fetch of the storage signed URL (the
              // request never reaches this catch with a useful message in that
              // case — check the Network tab for a red/failed request to the
              // storage host). Fall back to the raw URL; react-pdf's own fetch
              // will fail the same way and show the "open in new tab" fallback.
              console.error(`Nepodařilo se stáhnout PDF pro náhled (${f.name}):`, err);
              return [fileKey, remoteUrl];
            }
          }

          return [fileKey, remoteUrl];
        })
      );

      const newUrls = new Map<string, string>();
      for (const entry of entries) {
        if (entry) newUrls.set(entry[0], entry[1]);
      }

      setLoadedUrls(newUrls);
      setLoading(false);
    };

    loadUrls();

    return () => {
      // Cleanup blob URLs using the closure reference (not stale state)
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [open, allFiles]);

  const handleClose = () => {
    setError(null);
    onOpenChange(false);
  };

  const handleDownloadCurrent = () => {
    const currentFile = allFiles[currentDocIndex];
    if (!currentFile) return;
    
    const fileKey = currentFile.name + (currentFile.url || "");
    const url = loadedUrls.get(fileKey) || currentFile.url;
    
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = currentFile.name || "soubor";
      // `download` is ignored by browsers for cross-origin URLs (which the storage
      // signed URL always is) — without target="_blank" that means the click would
      // just navigate this tab away from the app instead of downloading.
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    updatePreference("pdfViewMode", mode);
  };

  const zoomIn = () => {
    setAutoFit(false);
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };
  const zoomOut = () => {
    setAutoFit(false);
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };
  const fitToPage = () => {
    setAutoFit(true);
  };

  // Auto-fit: spočítej scale tak, aby šířka stránky odpovídala dostupné oblasti.
  useEffect(() => {
    if (!autoFit || !mediaMeta || !contentRef.current) return;
    const computeFit = () => {
      const container = contentRef.current;
      if (!container) return;
      const availableW = container.clientWidth - 48; // padding
      const availableH = container.clientHeight - 80; // padding + header
      if (availableW <= 0 || availableH <= 0) return;
      const scaleW = availableW / mediaMeta.width;
      const scaleH = availableH / mediaMeta.height;
      // Vyber menší — celá strana se vejde bez ořezu
      const fitScale = Math.min(scaleW, scaleH, 2.5);
      setScale(Math.max(0.5, fitScale));
    };
    computeFit();
    const ro = new ResizeObserver(computeFit);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [autoFit, mediaMeta, currentDocIndex]);

  const getFileUrl = (f: PreviewFile) => {
    const fileKey = f.name + (f.url || "");
    return loadedUrls.get(fileKey) || f.url;
  };

  const isFilePDF = (f: PreviewFile) => {
    return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
  };

  const isFileImage = (f: PreviewFile) => {
    return f.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f.name);
  };

  const isFileExcel = (f: PreviewFile) => {
    return (
      f.type === "application/vnd.ms-excel" ||
      f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      /\.(xls|xlsx)$/i.test(f.name)
    );
  };

  const goToPrevDoc = () => {
    setCurrentDocIndex((prev) => Math.max(prev - 1, 0));
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToNextDoc = () => {
    setCurrentDocIndex((prev) => Math.min(prev + 1, allFiles.length - 1));
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToDoc = (index: number) => {
    setCurrentDocIndex(index);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Compute adaptive dialog dimensions based on the underlying media's aspect ratio.
  // - PDFs: viewport.width/height in points (A4 portrait ≈ 595×842, landscape ≈ 842×595).
  // - Images: natural pixel dimensions.
  // We constrain the dialog to fit the viewport while preserving aspect ratio so portrait
  // documents render narrower (no wasted side-space) and landscape/wide images render wider.
  const adaptiveStyle = useMemo<React.CSSProperties>(() => {
    if (typeof window === "undefined") return {};
    if (!mediaMeta || mediaMeta.width <= 0 || mediaMeta.height <= 0) {
      return { width: "min(90vw, 1024px)", height: "90vh" };
    }
    const aspect = mediaMeta.width / mediaMeta.height;
    const maxH = Math.round(window.innerHeight * 0.92);
    const maxW = Math.round(window.innerWidth * 0.95);
    const minW = 480;
    const contentH = maxH - 140; // header + padding budget
    let targetW = Math.round(contentH * aspect) + 64; // + horizontal padding
    targetW = Math.min(Math.max(targetW, minW), maxW);
    return {
      width: `${targetW}px`,
      maxWidth: `${maxW}px`,
      height: `${maxH}px`,
    };
  }, [mediaMeta]);

  if (!open) return null;

  const currentFile = allFiles[currentDocIndex];
  const dialogTitle = showMultipleFiles 
    ? `Dokument ${currentDocIndex + 1} z ${allFiles.length}` 
    : (allFiles[0]?.name || "Dokument");


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[95vh] flex flex-col p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Document Navigation for multiple files */}
              {showMultipleFiles && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={goToPrevDoc}
                    disabled={currentDocIndex === 0}
                    title="Předchozí dokument"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 min-w-[100px]">
                        <List className="w-4 h-4" />
                        <span className="text-xs">{currentDocIndex + 1} / {allFiles.length}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                      {allFiles.map((f, index) => (
                        <DropdownMenuItem
                          key={index}
                          onClick={() => goToDoc(index)}
                          className={index === currentDocIndex ? "bg-accent" : ""}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isFilePDF(f) ? (
                              <FileText className="w-4 h-4 shrink-0 text-primary" />
                            ) : (
                              <File className="w-4 h-4 shrink-0 text-primary" />
                            )}
                            <span className="truncate text-sm">{f.name}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={goToNextDoc}
                    disabled={currentDocIndex === allFiles.length - 1}
                    title="Další dokument"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              <DialogTitle className="text-base font-semibold truncate">
                {currentFile?.name || dialogTitle}
              </DialogTitle>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {/* View Mode Toggle for PDFs */}
              {hasPDFs && !loading && (
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
              )}
              
              {/* Zoom Controls (PDF + Images) */}
              {hasZoomable && !loading && (
                <>
                  <Separator orientation="vertical" className="h-6" />
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
                    <Button
                      variant={autoFit ? "secondary" : "ghost"}
                      size="sm"
                      onClick={fitToPage}
                      title="Přizpůsobit stránce (vejde se celá)"
                      className="text-xs min-w-[55px]"
                    >
                      {autoFit ? "Fit" : `${Math.round(scale * 100)}%`}
                    </Button>
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
                  <Separator orientation="vertical" className="h-6" />
                </>
              )}

              <Button
                variant="outline"
                size="icon"
                onClick={handleDownloadCurrent}
                title="Stáhnout"
                disabled={allFiles.length === 0}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto p-6"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <p className="text-destructive">{error}</p>
                <Button onClick={handleDownloadCurrent}>
                  <Download className="w-4 h-4 mr-2" />
                  Stáhnout soubor
                </Button>
              </div>
            </div>
          ) : allFiles.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Žádné soubory k zobrazení</p>
            </div>
          ) : currentFile ? (
            <div className="border rounded-lg bg-muted/30 p-4">
              {isFilePDF(currentFile) ? (
                <PDFViewer
                  url={getFileUrl(currentFile)}
                  originalUrl={currentFile.url}
                  fileName={currentFile.name}
                  scale={scale}
                  viewMode={viewMode}
                  showHeader={false}
                  onFirstPageMeta={(m) => setMediaMeta(m)}
                />
              ) : isFileImage(currentFile) ? (
                <ImageViewer
                  url={getFileUrl(currentFile)}
                  fileName={currentFile.name}
                  scale={scale}
                  showHeader={false}
                  onMeta={(m) => setMediaMeta(m)}
                />
              ) : isFileExcel(currentFile) ? (
                <ExcelViewer
                  url={getFileUrl(currentFile)}
                  fileName={currentFile.name}
                  showHeader={false}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-32 space-y-2">
                  <File className="w-12 h-12 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">
                    Náhled není k dispozici pro tento typ souboru.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDownloadCurrent}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Stáhnout
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
