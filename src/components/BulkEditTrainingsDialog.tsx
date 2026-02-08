import { useState } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarClock, Upload, X, FileText, FileImage, File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFacilities } from "@/hooks/useFacilities";

interface BulkEditTrainingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSuccess: () => void;
}

export function BulkEditTrainingsDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: BulkEditTrainingsDialogProps) {
  const { toast } = useToast();
  const { facilities } = useFacilities();
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    trainer: "",
    company: "",
    note: "",
    facility: "",
    lastTrainingDate: undefined as Date | undefined,
    keepExistingFiles: false,
    uploadedFiles: [] as File[],
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (extension === "pdf") {
      return <FileText className="w-5 h-5 text-red-500" />;
    } else if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension || "")) {
      return <FileImage className="w-5 h-5 text-blue-500" />;
    } else if (["doc", "docx"].includes(extension || "")) {
      return <FileText className="w-5 h-5 text-blue-600" />;
    }
    return <File className="w-5 h-5 text-muted-foreground" />;
  };

  const resetForm = () => {
    setFormData({
      trainer: "",
      company: "",
      note: "",
      facility: "",
      lastTrainingDate: undefined,
      keepExistingFiles: false,
      uploadedFiles: [],
    });
    setUploadProgress(0);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const ALLOWED_TYPES = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];

    const errors: string[] = [];
    const validFiles: File[] = [];

    files.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: Příliš velký soubor (max 10MB)`);
        return;
      }

      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      const isValidType =
        ALLOWED_TYPES.includes(file.type) ||
        ["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(fileExtension || "");

      if (!isValidType) {
        errors.push(`${file.name}: Nepodporovaný typ souboru`);
        return;
      }

      validFiles.push(file);
    });

    if (errors.length > 0) {
      toast({
        title: "Některé soubory nebyly přidány",
        description: errors.join(", "),
        variant: "destructive",
      });
    }

    if (validFiles.length > 0) {
      setFormData({
        ...formData,
        uploadedFiles: [...formData.uploadedFiles, ...validFiles],
      });
    }

    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFormData({
      ...formData,
      uploadedFiles: formData.uploadedFiles.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;

    setLoading(true);

    try {
      const updates: Record<string, unknown> = {};
      if (formData.trainer.trim() !== "") {
        updates.trainer = formData.trainer.trim();
      }
      if (formData.company.trim() !== "") {
        updates.company = formData.company.trim();
      }
      if (formData.note.trim() !== "") {
        updates.note = formData.note.trim();
      }
      if (formData.facility !== "") {
        const facilityEntry = facilities.find((f) => f.name === formData.facility);
        if (facilityEntry) {
          updates.facility = facilityEntry.code;
        }
      }
      if (formData.lastTrainingDate) {
        updates.last_training_date = format(formData.lastTrainingDate, "yyyy-MM-dd");
      }

      if (Object.keys(updates).length === 0 && formData.uploadedFiles.length === 0) {
        toast({
          title: "Žádné změny",
          description: "Nevyplnili jste žádné pole pro úpravu ani nenahrali soubory.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Uživatel není přihlášen");
      }

      if (formData.lastTrainingDate) {
        for (const trainingId of selectedIds) {
          const { data: training, error: fetchError } = await supabase
            .from("trainings")
            .select("training_types(period_days)")
            .eq("id", trainingId)
            .single();

          if (fetchError) throw fetchError;

          const periodDays = (training as { training_types?: { period_days?: number } })?.training_types?.period_days || 365;
          const nextDate = new Date(formData.lastTrainingDate);
          nextDate.setDate(nextDate.getDate() + periodDays);

          const individualUpdates = {
            ...updates,
            next_training_date: format(nextDate, "yyyy-MM-dd"),
          };

          const { error: updateError } = await supabase
            .from("trainings")
            .update(individualUpdates)
            .eq("id", trainingId);

          if (updateError) throw updateError;
        }
      } else if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("trainings").update(updates).in("id", selectedIds);
        if (error) throw error;
      }

      if (formData.uploadedFiles.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);

        const totalFiles = formData.uploadedFiles.length * selectedIds.length;
        let uploadedCount = 0;

        for (const trainingId of selectedIds) {
          if (!formData.keepExistingFiles) {
            const { data: existingDocs, error: docsError } = await supabase
              .from("training_documents")
              .select("file_path")
              .eq("training_id", trainingId);

            if (docsError) throw docsError;

            if (existingDocs && existingDocs.length > 0) {
              const filePaths = existingDocs.map((doc) => doc.file_path);
              await supabase.storage.from("training-documents").remove(filePaths);
              await supabase.from("training_documents").delete().eq("training_id", trainingId);
            }
          }

          for (const file of formData.uploadedFiles) {
            const fileExt = file.name.split(".").pop();
            const fileName = `${trainingId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("training-documents")
              .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { error: docError } = await supabase.from("training_documents").insert({
              training_id: trainingId,
              file_name: file.name,
              file_path: fileName,
              file_type: file.type,
              file_size: file.size,
              document_type: file.type.includes("pdf") ? "certificate" : "other",
              uploaded_by: user.id,
            });

            if (docError) throw docError;

            uploadedCount++;
            setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
          }
        }

        setIsUploading(false);
        setUploadProgress(0);
      }

      toast({
        title: "Hromadná úprava provedena",
        description: `Úspěšně aktualizováno ${selectedIds.length} školení${
          formData.uploadedFiles.length > 0
            ? ` a nahráno ${formData.uploadedFiles.length} souborů`
            : ""
        }.`,
      });

      handleClose();
      onSuccess();
    } catch (error: unknown) {
      console.error("Error in bulk edit:", error);
      toast({
        title: "Chyba při hromadné úpravě",
        description: (error as Error).message || "Nepodařilo se aktualizovat školení.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hromadná úprava školení</DialogTitle>
          <DialogDescription>
            Změny budou aplikovány na {selectedIds.length} školení. Prázdná pole zůstanou beze změny.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Datum posledního školení</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.lastTrainingDate && "text-muted-foreground"
                  )}
                >
                  <CalendarClock className="mr-2 h-4 w-4" />
                  {formData.lastTrainingDate ? (
                    format(formData.lastTrainingDate, "d. MMMM yyyy", { locale: cs })
                  ) : (
                    <span>Vyberte datum (ponechat prázdné pro beze změny)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.lastTrainingDate}
                  onSelect={(date) => setFormData({ ...formData, lastTrainingDate: date })}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Datum dalšího školení se vypočítá automaticky podle periody každého školení
            </p>
          </div>

          <div className="space-y-2">
            <Label>Školitel</Label>
            <Input
              placeholder="Nový školitel (ponechat prázdné pro beze změny)"
              value={formData.trainer}
              onChange={(e) => setFormData({ ...formData, trainer: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Firma</Label>
            <Input
              placeholder="Nová firma (ponechat prázdné pro beze změny)"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Provozovna</Label>
            <Select
              value={formData.facility}
              onValueChange={(value) =>
                setFormData({ ...formData, facility: value === "__none__" ? "" : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyberte provozovnu (ponechat prázdné pro beze změny)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- Bez změny --</SelectItem>
                {facilities.map((f) => (
                  <SelectItem key={f.id} value={f.name}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Poznámka</Label>
            <Textarea
              placeholder="Nová poznámka (ponechat prázdné pro beze změny)"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label>Soubory (PDF, dokumenty)</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="bulk-training-file-upload"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("bulk-training-file-upload")?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Nahrát soubory
                </Button>
              </div>

              {formData.uploadedFiles.length > 0 && (
                <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      Vybrané soubory ({formData.uploadedFiles.length})
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, uploadedFiles: [] })}
                      className="text-muted-foreground hover:text-destructive h-6 px-2"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Odstranit vše
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {formData.uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded bg-background border"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(file.name)}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-muted-foreground hover:text-destructive h-6 w-6 p-0 flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Checkbox
                      id="keep-existing"
                      checked={formData.keepExistingFiles}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, keepExistingFiles: !!checked })
                      }
                    />
                    <Label htmlFor="keep-existing" className="text-sm cursor-pointer">
                      Ponechat stávající soubory (přidat nové)
                    </Label>
                  </div>
                </div>
              )}

              {isUploading && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Nahrávání souborů... {uploadProgress}%
                  </p>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Soubory budou nahrány ke všem vybraným školením
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose} disabled={loading || isUploading}>
            Zrušit
          </Button>
          <Button onClick={handleSubmit} disabled={loading || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Nahrávání... {uploadProgress}%
              </>
            ) : loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Ukládám...
              </>
            ) : (
              "Aplikovat změny"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
