import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Upload, X, FileText, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export interface UploadedFile {
  file: File;
  documentType: string;
  description?: string;
  id: string;
}

interface FileUploaderProps {
  onFilesChange: (files: UploadedFile[]) => void;
  files: UploadedFile[];
  maxFiles?: number;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
}

const DOCUMENT_TYPES = [
  { value: "certificate", label: "Certifikát" },
  { value: "attendance_sheet", label: "Prezenční listina" },
  { value: "protocol", label: "Protokol" },
  { value: "other", label: "Jiné" },
];

export function FileUploader({
  onFilesChange,
  files,
  maxFiles = 10,
  maxSize = 20, // 20MB default
  acceptedTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"],
}: FileUploaderProps) {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      return `Soubor ${file.name} je příliš velký. Maximum je ${maxSize}MB.`;
    }

    // Check file type
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!acceptedTypes.some((type) => fileExtension === type.toLowerCase())) {
      return `Nepodporovaný typ souboru: ${file.name}`;
    }

    return null;
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    if (files.length + newFiles.length > maxFiles) {
      toast({
        title: "Příliš mnoho souborů",
        description: `Můžete nahrát maximálně ${maxFiles} souborů.`,
        variant: "destructive",
      });
      return;
    }

    const validFiles: UploadedFile[] = [];
    
    Array.from(newFiles).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        toast({
          title: "Chyba při nahrávání",
          description: error,
          variant: "destructive",
        });
        return;
      }

      validFiles.push({
        file,
        documentType: "other",
        id: Math.random().toString(36).substring(7),
      });
    });

    if (validFiles.length > 0) {
      onFilesChange([...files, ...validFiles]);
      toast({
        title: "Soubory přidány",
        description: `Přidáno ${validFiles.length} soubor(ů)`,
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    handleFiles(e.target.files);
  };

  const removeFile = (id: string) => {
    onFilesChange(files.filter((f) => f.id !== id));
  };

  const updateFileType = (id: string, documentType: string) => {
    onFilesChange(
      files.map((f) => (f.id === id ? { ...f, documentType } : f))
    );
  };

  const updateFileDescription = (id: string, description: string) => {
    onFilesChange(
      files.map((f) => (f.id === id ? { ...f, description } : f))
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? "border-primary bg-accent"
            : "border-border hover:border-primary hover:bg-accent/50"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={files.length >= maxFiles}
        />
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-10 h-10 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              Přetáhněte soubory sem nebo klikněte pro výběr
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Povolené formáty: {acceptedTypes.join(", ")} (max. {maxSize}MB)
            </p>
            <p className="text-xs text-muted-foreground">
              Náhled: pouze PDF a obrázky (JPG, PNG)
            </p>
            <p className="text-xs text-muted-foreground">
              Maximum {maxFiles} souborů
            </p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          <Label>Nahrané soubory ({files.length})</Label>
          {files.map((uploadedFile) => (
            <Card key={uploadedFile.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-accent rounded">
                    {uploadedFile.file.type.includes("pdf") ? (
                      <FileText className="w-5 h-5 text-primary" />
                    ) : (
                      <File className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {uploadedFile.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(uploadedFile.file.size)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(uploadedFile.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Typ dokumentu *</Label>
                    <Select
                      value={uploadedFile.documentType}
                      onValueChange={(value) =>
                        updateFileType(uploadedFile.id, value)
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Popis (volitelné)</Label>
                    <Input
                      placeholder="Poznámka k dokumentu..."
                      value={uploadedFile.description || ""}
                      onChange={(e) =>
                        updateFileDescription(uploadedFile.id, e.target.value)
                      }
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
