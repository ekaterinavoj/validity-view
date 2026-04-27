import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { uploadGeneralDocument, getGeneralDocuments, deleteGeneralDocument, getGeneralDocumentUrl } from "@/lib/generalDocuments";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { TablePagination } from "@/components/TablePagination";
import { HelpButton } from "@/components/HelpButton";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { usePagination } from "@/hooks/usePagination";
import { PlusCircle, Search, Trash2, Download, FileText, Upload, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface GeneralDocument {
  id: string;
  name: string;
  group_name: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  uploaded_at: string;
}

function PaginatedDocSection({
  docs,
  itemsPerPage,
  groupName,
  renderActions,
  formatFileSize,
}: {
  docs: GeneralDocument[];
  itemsPerPage: number;
  groupName: string;
  renderActions: (doc: GeneralDocument) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
}) {
  const { currentPage, setCurrentPage, totalPages, paginatedItems, totalItems } = usePagination(docs, itemsPerPage);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:hidden">
        {paginatedItems.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="font-medium text-foreground">{doc.name}</p>
                <p className="text-sm text-muted-foreground truncate">{doc.file_name}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{groupName}</Badge>
                <span>{formatFileSize(doc.file_size)}</span>
                <span>{format(new Date(doc.uploaded_at), "d. M. yyyy", { locale: cs })}</span>
              </div>
              <div className="flex justify-end">{renderActions(doc)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Název</TableHead>
              <TableHead>Soubor</TableHead>
              <TableHead>Velikost</TableHead>
              <TableHead>Nahráno</TableHead>
              <TableHead className="text-right">Akce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">{doc.file_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatFileSize(doc.file_size)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(doc.uploaded_at), "d. M. yyyy", { locale: cs })}
                </TableCell>
                <TableCell className="text-right">{renderActions(doc)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}

export default function Documents() {
  const { isAdmin, isManager } = useAuth();
  const { toast } = useToast();
  const { preferences } = useUserPreferences();

  const [documents, setDocuments] = useState<GeneralDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [docName, setDocName] = useState("");
  const [docGroup, setDocGroup] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Array<{ name: string; url: string; type: string }>>([]);

  const loadDocuments = async () => {
    setLoading(true);
    const { data, error } = await getGeneralDocuments();
    if (error) {
      toast({ title: "Chyba", description: "Nepodařilo se načíst dokumenty", variant: "destructive" });
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const groups = useMemo(() => {
    return [...new Set(documents.map((d) => d.group_name))].sort((a, b) => a.localeCompare(b, "cs"));
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return documents.filter((doc) => {
      const matchesSearch =
        query === "" ||
        doc.name.toLowerCase().includes(query) ||
        doc.file_name.toLowerCase().includes(query) ||
        doc.group_name.toLowerCase().includes(query);
      const matchesGroup = groupFilter === "all" || doc.group_name === groupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [documents, searchQuery, groupFilter]);

  const folderSections = useMemo(() => {
    const grouped = new Map<string, GeneralDocument[]>();

    filteredDocuments.forEach((doc) => {
      const existing = grouped.get(doc.group_name) ?? [];
      existing.push(doc);
      grouped.set(doc.group_name, existing);
    });

    return [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "cs"))
      .map(([groupName, docs]) => ({ groupName, docs }));
  }, [filteredDocuments]);

  const defaultOpenFolders = useMemo(() => {
    if (folderSections.length === 1) {
      return [folderSections[0].groupName];
    }

    if (groupFilter !== "all") {
      return folderSections.map((section) => section.groupName);
    }

    return [] as string[];
  }, [folderSections, groupFilter]);

  const handleUpload = async () => {
    if (!docName.trim() || !docGroup.trim() || !docFile) {
      toast({ title: "Chyba", description: "Vyplňte všechna pole a vyberte soubor", variant: "destructive" });
      return;
    }

    setUploading(true);
    const { error } = await uploadGeneralDocument(docFile, docName.trim(), docGroup.trim());
    setUploading(false);

    if (error) {
      toast({ title: "Chyba", description: "Nepodařilo se nahrát dokument", variant: "destructive" });
    } else {
      toast({ title: "Úspěch", description: "Dokument byl nahrán" });
      setDocName("");
      setDocGroup("");
      setDocFile(null);
      setDialogOpen(false);
      loadDocuments();
    }
  };

  const handleDelete = async (doc: GeneralDocument) => {
    const { error } = await deleteGeneralDocument(doc.id, doc.file_path);
    if (error) {
      toast({ title: "Chyba", description: "Nepodařilo se smazat dokument", variant: "destructive" });
    } else {
      toast({ title: "Smazáno", description: "Dokument byl smazán" });
      loadDocuments();
    }
  };

  const handlePreview = async (doc: GeneralDocument) => {
    const url = await getGeneralDocumentUrl(doc.file_path);
    if (url) {
      setPreviewFiles([{ name: doc.file_name, url, type: doc.file_type }]);
      setPreviewOpen(true);
    } else {
      toast({ title: "Chyba", description: "Nepodařilo se získat odkaz na soubor", variant: "destructive" });
    }
  };

  const handleDownload = async (doc: GeneralDocument) => {
    const url = await getGeneralDocumentUrl(doc.file_path);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canPreview = (type: string) => type === "application/pdf" || type.startsWith("image/");

  const renderActions = (doc: GeneralDocument) => (
    <div className="flex items-center justify-end gap-1">
      {canPreview(doc.file_type) && (
        <Button variant="ghost" size="sm" onClick={() => handlePreview(doc)} title="Náhled">
          <FileText className="w-4 h-4 text-primary" />
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)} title="Stáhnout">
        <Download className="w-4 h-4" />
      </Button>
      {(isAdmin || isManager) && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" title="Smazat">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Smazat dokument?</AlertDialogTitle>
              <AlertDialogDescription>
                Opravdu chcete smazat dokument &quot;{doc.name}&quot;? Tato akce je nevratná.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(doc)}>Smazat</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-bold text-foreground">Dokumenty</h1>
            <HelpButton section="dokumenty" label="Nápověda: Dokumenty" />
          </div>
          <p className="text-muted-foreground">Firemní dokumenty rozdělené do přehledných složek podle skupin.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusCircle className="w-4 h-4" />
              Nahrát dokument
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nahrát nový dokument</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="doc-name">Název dokumentu</Label>
                <Input
                  id="doc-name"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="např. Provozní řád haly A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-group">Skupina / složka</Label>
                <Input
                  id="doc-group"
                  value={docGroup}
                  onChange={(e) => setDocGroup(e.target.value)}
                  placeholder="např. Provozní řády"
                  list="group-suggestions"
                />
                <datalist id="group-suggestions">
                  {groups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">Pokud skupina ještě neexistuje, vytvoří se automaticky jako nová složka.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-file">Soubor</Label>
                <Input
                  id="doc-file"
                  type="file"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                />
                <p className="text-xs text-muted-foreground">
                  Podporované formáty: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT. Náhled: PDF, JPG, PNG.
                </p>
              </div>
              <Button onClick={handleUpload} disabled={uploading} className="w-full gap-2">
                <Upload className="w-4 h-4" />
                {uploading ? "Nahrávám..." : "Nahrát"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hledat podle názvu, souboru nebo skupiny..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={groupFilter === "all" ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setGroupFilter("all")}
            >
              <FolderOpen className="w-4 h-4" />
              Všechny složky
              <Badge variant="secondary">{documents.length}</Badge>
            </Button>
            {groups.map((group) => {
              const count = documents.filter((doc) => doc.group_name === group).length;
              return (
                <Button
                  key={group}
                  type="button"
                  variant={groupFilter === group ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={() => setGroupFilter(group)}
                >
                  <FolderOpen className="w-4 h-4" />
                  {group}
                  <Badge variant="secondary">{count}</Badge>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            {groupFilter === "all" ? "Složky dokumentů" : `Složka: ${groupFilter}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Načítám...</p>
          ) : folderSections.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {documents.length === 0
                ? "Zatím nebyly nahrány žádné dokumenty"
                : "Žádné dokumenty neodpovídají vybranému filtru nebo hledání"}
            </p>
          ) : (
            <Accordion
              key={`${groupFilter}-${searchQuery}-${folderSections.length}`}
              type="multiple"
              defaultValue={defaultOpenFolders}
              className="w-full"
            >
              {folderSections.map((section) => (
                <AccordionItem key={section.groupName} value={section.groupName}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full items-center justify-between pr-4">
                      <div className="flex items-center gap-3 text-left">
                        <FolderOpen className="w-4 h-4 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">{section.groupName}</p>
                          <p className="text-xs text-muted-foreground">{section.docs.length} dokumentů</p>
                        </div>
                      </div>
                      <Badge variant="secondary">{section.docs.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <PaginatedDocSection
                      docs={section.docs}
                      itemsPerPage={preferences.itemsPerPage}
                      groupName={section.groupName}
                      renderActions={renderActions}
                      formatFileSize={formatFileSize}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <FilePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={null}
        files={previewFiles}
      />
    </div>
  );
}
