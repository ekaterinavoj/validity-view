import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { uploadGeneralDocument, getGeneralDocuments, deleteGeneralDocument, getGeneralDocumentUrl } from "@/lib/generalDocuments";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { PlusCircle, Search, Trash2, Download, Eye, FileText, Upload } from "lucide-react";
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

export default function Documents() {
  const { isAdmin, isManager } = useAuth();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<GeneralDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [docName, setDocName] = useState("");
  const [docGroup, setDocGroup] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");

  // Preview state
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

  // Get unique groups for filter
  const groups = useMemo(() => {
    const unique = [...new Set(documents.map(d => d.group_name))].sort();
    return unique;
  }, [documents]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = searchQuery === "" ||
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.group_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup = groupFilter === "all" || doc.group_name === groupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [documents, searchQuery, groupFilter]);

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

  const canPreview = (type: string) => {
    return type === "application/pdf" || type.startsWith("image/");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dokumentace</h1>
          <p className="text-muted-foreground">Správa firemních dokumentů</p>
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
                <Label htmlFor="doc-group">Skupina</Label>
                <Input
                  id="doc-group"
                  value={docGroup}
                  onChange={(e) => setDocGroup(e.target.value)}
                  placeholder="např. Provozní řády"
                  list="group-suggestions"
                />
                <datalist id="group-suggestions">
                  {groups.map(g => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Hledat podle názvu, souboru nebo skupiny..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Skupina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všechny skupiny</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Dokumenty ({filteredDocuments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Načítám...</p>
          ) : filteredDocuments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {documents.length === 0 ? "Zatím nebyly nahrány žádné dokumenty" : "Žádné dokumenty neodpovídají filtru"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Název</TableHead>
                    <TableHead>Skupina</TableHead>
                    <TableHead>Soubor</TableHead>
                    <TableHead>Velikost</TableHead>
                    <TableHead>Nahráno</TableHead>
                    <TableHead className="text-right">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{doc.group_name}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {doc.file_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatFileSize(doc.file_size)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(doc.uploaded_at), "d. M. yyyy", { locale: cs })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canPreview(doc.file_type) && (
                            <Button variant="ghost" size="sm" onClick={() => handlePreview(doc)} title="Náhled">
                              <Eye className="w-4 h-4" />
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
                                    Opravdu chcete smazat dokument "{doc.name}"? Tato akce je nevratná.
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
