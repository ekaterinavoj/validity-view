import { StatusBadge } from "@/components/StatusBadge";
import { StatusLegend } from "@/components/StatusLegend";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, Plus, CalendarClock, FileSpreadsheet, FileDown, Upload, X, FileText, FileImage, File, Eye, Loader2, Archive, ArchiveRestore } from "lucide-react";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { useFacilities } from "@/hooks/useFacilities";
import { Progress } from "@/components/ui/progress";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilters } from "@/components/AdvancedFilters";
import { TrainingProtocolCell } from "@/components/TrainingProtocolCell";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPeriodicity } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTrainings, TrainingWithDetails } from "@/hooks/useTrainings";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { RefreshCw } from "lucide-react";

export default function ScheduledTrainings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { trainings, loading: trainingsLoading, error: trainingsError, refetch } = useTrainings(true);
  const { facilities: facilitiesData } = useFacilities();
  const [selectedTrainings, setSelectedTrainings] = useState<Set<string>>(new Set());
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    trainer: "",
    company: "",
    note: "",
    facility: "",
    lastTrainingDate: undefined as Date | undefined,
    keepExistingFiles: false,
    uploadedFiles: [] as File[],
  });

  // Create a map of facility code to name for display
  const facilityNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    facilitiesData.forEach(f => {
      map[f.code] = f.name;
    });
    return map;
  }, [facilitiesData]);

  // Create sorted list of facility names for filter dropdown
  const facilityNamesForFilter = useMemo(() => {
    return facilitiesData.map(f => f.name).sort();
  }, [facilitiesData]);

  // Helper to get facility name from code
  const getFacilityName = (code: string): string => {
    return facilityNameMap[code] || code;
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (extension === 'pdf') {
      return <FileText className="w-5 h-5 text-red-500" />;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return <FileImage className="w-5 h-5 text-blue-500" />;
    } else if (['doc', 'docx'].includes(extension || '')) {
      return <FileText className="w-5 h-5 text-blue-600" />;
    } else {
      return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    saveCurrentFilters,
    loadSavedFilter,
    deleteSavedFilter,
    savedFilters,
  } = useAdvancedFilters("scheduled-trainings-filters");

  // Get unique values for filters from real data
  const departments = useMemo(() => {
    const depts = new Set(trainings.map((t) => t.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [trainings]);

  const facilityCodes = useMemo(() => {
    const facilitySet = new Set(trainings.map((t) => t.facility).filter(Boolean));
    return Array.from(facilitySet).sort();
  }, [trainings]);

  // Convert facility codes to names for filter display
  const facilities = useMemo(() => {
    return facilityCodes.map(code => getFacilityName(code)).sort();
  }, [facilityCodes, facilityNameMap]);

  const trainingTypes = useMemo(() => {
    const types = new Set(trainings.map((t) => t.type).filter(Boolean));
    return Array.from(types).sort();
  }, [trainings]);

  const trainers = useMemo(() => {
    const trainerSet = new Set(trainings.map((t) => t.trainer).filter(Boolean));
    return Array.from(trainerSet).sort();
  }, [trainings]);

  // Filter data
  const filteredTrainings = useMemo(() => {
    return trainings.filter((training) => {
      const searchLower = filters.searchQuery.toLowerCase();
      const matchesSearch =
        filters.searchQuery === "" ||
        training.employeeName.toLowerCase().includes(searchLower) ||
        training.employeeNumber.includes(searchLower) ||
        training.type.toLowerCase().includes(searchLower) ||
        training.department.toLowerCase().includes(searchLower) ||
        training.trainer.toLowerCase().includes(searchLower);

      const matchesStatus =
        filters.statusFilter === "all" || training.status === filters.statusFilter;
      const matchesFacility =
        filters.facilityFilter === "all" || getFacilityName(training.facility) === filters.facilityFilter;
      const matchesDepartment =
        filters.departmentFilter === "all" ||
        training.department === filters.departmentFilter;
      const matchesType =
        filters.typeFilter === "all" || training.type === filters.typeFilter;
      const matchesTrainer =
        filters.trainerFilter === "all" || training.trainer === filters.trainerFilter;

      const trainingDate = new Date(training.date);
      const matchesDateFrom =
        !filters.dateFrom || trainingDate >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || trainingDate <= filters.dateTo;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesFacility &&
        matchesDepartment &&
        matchesType &&
        matchesTrainer &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [filters, trainings]);

  const toggleSelectAll = () => {
    if (selectedTrainings.size === filteredTrainings.length) {
      setSelectedTrainings(new Set());
    } else {
      setSelectedTrainings(new Set(filteredTrainings.map(t => t.id)));
    }
  };

  const toggleSelectTraining = (id: string) => {
    const newSelected = new Set(selectedTrainings);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTrainings(newSelected);
  };

  const handleBulkEdit = () => {
    if (selectedTrainings.size === 0) {
      toast({
        title: "Žádná školení vybrána",
        description: "Vyberte alespoň jedno školení pro hromadnou úpravu.",
        variant: "destructive",
      });
      return;
    }
    setBulkEditDialogOpen(true);
  };

  const applyBulkEdit = async () => {
    if (selectedTrainings.size === 0) {
      return;
    }

    setLoading(true);
    
    try {
      const updates: any = {};
      if (bulkEditData.trainer.trim() !== "") {
        updates.trainer = bulkEditData.trainer.trim();
      }
      if (bulkEditData.company.trim() !== "") {
        updates.company = bulkEditData.company.trim();
      }
      if (bulkEditData.note.trim() !== "") {
        updates.note = bulkEditData.note.trim();
      }
      if (bulkEditData.facility !== "") {
        // Find the facility code from the name
        const facilityEntry = facilitiesData.find(f => f.name === bulkEditData.facility);
        if (facilityEntry) {
          updates.facility = facilityEntry.code;
        }
      }
      if (bulkEditData.lastTrainingDate) {
        updates.last_training_date = format(bulkEditData.lastTrainingDate, "yyyy-MM-dd");
      }

      if (Object.keys(updates).length === 0 && bulkEditData.uploadedFiles.length === 0) {
        toast({
          title: "Žádné změny",
          description: "Nevyplnili jste žádné pole pro úpravu ani nenahrali soubory.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Uživatel není přihlášen");
      }

      const selectedIds = Array.from(selectedTrainings);

      if (bulkEditData.lastTrainingDate) {
        for (const trainingId of selectedIds) {
          const { data: training, error: fetchError } = await supabase
            .from("trainings")
            .select("training_types(period_days)")
            .eq("id", trainingId)
            .single();

          if (fetchError) throw fetchError;

          const periodDays = (training as any).training_types?.period_days || 365;
          const nextDate = new Date(bulkEditData.lastTrainingDate);
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
        const { error } = await supabase
          .from("trainings")
          .update(updates)
          .in("id", selectedIds);

        if (error) throw error;
      }

      if (bulkEditData.uploadedFiles.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);
        
        const totalFiles = bulkEditData.uploadedFiles.length * selectedIds.length;
        let uploadedCount = 0;
        
        for (const trainingId of selectedIds) {
          if (!bulkEditData.keepExistingFiles) {
            const { data: existingDocs, error: docsError } = await supabase
              .from("training_documents")
              .select("file_path")
              .eq("training_id", trainingId);

            if (docsError) throw docsError;

            if (existingDocs && existingDocs.length > 0) {
              const filePaths = existingDocs.map(doc => doc.file_path);
              await supabase.storage
                .from("training-documents")
                .remove(filePaths);

              await supabase
                .from("training_documents")
                .delete()
                .eq("training_id", trainingId);
            }
          }

          for (const file of bulkEditData.uploadedFiles) {
            const fileExt = file.name.split(".").pop();
            const fileName = `${trainingId}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("training-documents")
              .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { error: docError } = await supabase
              .from("training_documents")
              .insert({
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
        description: `Úspěšně aktualizováno ${selectedTrainings.size} školení${bulkEditData.uploadedFiles.length > 0 ? ` a nahráno ${bulkEditData.uploadedFiles.length} souborů` : ""}.`,
      });

      setBulkEditDialogOpen(false);
      setSelectedTrainings(new Set());
      setBulkEditData({
        trainer: "",
        company: "",
        note: "",
        facility: "",
        lastTrainingDate: undefined,
        keepExistingFiles: false,
        uploadedFiles: [],
      });
      
      refetch();
    } catch (error: any) {
      console.error("Error in bulk edit:", error);
      toast({
        title: "Chyba při hromadné úpravě",
        description: error.message || "Nepodařilo se aktualizovat školení.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkArchive = () => {
    if (selectedTrainings.size === 0) {
      toast({
        title: "Žádná školení vybrána",
        description: "Vyberte alespoň jedno školení pro archivaci.",
        variant: "destructive",
      });
      return;
    }

    setDeleteDialogOpen(true);
  };

  const confirmBulkArchive = async () => {
    if (selectedTrainings.size === 0) {
      return;
    }

    setLoading(true);
    
    try {
      const selectedIds = Array.from(selectedTrainings);
      
      // Soft-delete: set deleted_at timestamp instead of hard delete
      const { error } = await supabase
        .from("trainings")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", selectedIds);

      if (error) throw error;
      
      toast({
        title: "Školení archivována",
        description: `Úspěšně archivováno ${selectedTrainings.size} školení. Jsou stále dostupná v Historii školení.`,
      });

      setSelectedTrainings(new Set());
      setDeleteDialogOpen(false);
      
      refetch();
    } catch (error: any) {
      console.error("Error in bulk archive:", error);
      toast({
        title: "Chyba při archivaci",
        description: error.message || "Nepodařilo se archivovat školení.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectExpiringTrainings = (daysAhead: number = 30) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysAhead);
    
    const expiringIds = filteredTrainings
      .filter(training => {
        const trainingDate = new Date(training.date);
        trainingDate.setHours(0, 0, 0, 0);
        return trainingDate >= today && trainingDate <= targetDate;
      })
      .map(t => t.id);
    
    setSelectedTrainings(new Set(expiringIds));
    
    toast({
      title: "Výběr dokončen",
      description: `Vybráno ${expiringIds.length} školení expirujících do ${daysAhead} dní.`,
    });
  };

  const selectedTrainingDetails = useMemo(() => {
    return filteredTrainings.filter(t => selectedTrainings.has(t.id));
  }, [selectedTrainings, filteredTrainings]);

  const exportToCSV = () => {
    try {
      const trainingsToExport = selectedTrainings.size > 0
        ? filteredTrainings.filter(t => selectedTrainings.has(t.id))
        : filteredTrainings;

      if (trainingsToExport.length === 0) {
        toast({
          title: "Žádná data k exportu",
          description: "Nejsou k dispozici žádná školení pro export.",
          variant: "destructive",
        });
        return;
      }

      const headers = [
        "Stav",
        "Školení platné do",
        "Typ školení",
        "Osobní číslo",
        "Jméno",
        "Provozovna",
        "Středisko",
        "Datum školení",
        "Školitel",
        "Firma",
        "Zadavatel",
        "Periodicita",
        "Poznámka"
      ];

      const statusMap = {
        valid: "Platné",
        warning: "Brzy vyprší",
        expired: "Prošlé"
      };

      const rows = trainingsToExport.map(training => [
        statusMap[training.status],
        new Date(training.date).toLocaleDateString("cs-CZ"),
        training.type,
        training.employeeNumber,
        training.employeeName,
        getFacilityName(training.facility),
        training.department,
        new Date(training.lastTrainingDate).toLocaleDateString("cs-CZ"),
        training.trainer,
        training.company,
        training.requester,
        formatPeriodicity(training.period),
        training.note
      ]);

      const escapeCSV = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
      ].join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `skoleni_export_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${trainingsToExport.length} školení.`,
      });
    } catch (error) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  const exportToExcel = () => {
    try {
      const trainingsToExport = selectedTrainings.size > 0
        ? filteredTrainings.filter(t => selectedTrainings.has(t.id))
        : filteredTrainings;

      if (trainingsToExport.length === 0) {
        toast({
          title: "Žádná data k exportu",
          description: "Nejsou k dispozici žádná školení pro export.",
          variant: "destructive",
        });
        return;
      }

      const wb = XLSX.utils.book_new();

      const statusMap = {
        valid: "Platne",
        warning: "Brzy vyprsi",
        expired: "Prosle"
      };

      const data = [
        ['Stav', 'Skoleni platne do', 'Typ skoleni', 'Osobni cislo', 'Jmeno', 'Provozovna', 'Stredisko', 'Datum skoleni', 'Skolitel', 'Firma', 'Zadavatel', 'Periodicita', 'Poznamka'],
        ...trainingsToExport.map(t => [
          statusMap[t.status],
          new Date(t.date).toLocaleDateString("cs-CZ"),
          t.type,
          t.employeeNumber,
          t.employeeName,
          getFacilityName(t.facility),
          t.department,
          new Date(t.lastTrainingDate).toLocaleDateString("cs-CZ"),
          t.trainer || '',
          t.company || '',
          t.requester || '',
          formatPeriodicity(t.period),
          t.note || ''
        ])
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      
      ws['!cols'] = [
        { wch: 12 },
        { wch: 15 },
        { wch: 25 },
        { wch: 12 },
        { wch: 20 },
        { wch: 40 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 25 },
        { wch: 20 },
        { wch: 12 },
        { wch: 30 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Skoleni');

      const timestamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `skoleni_export_${timestamp}.xlsx`);

      toast({
        title: "Export dokončen",
        description: `Exportováno ${trainingsToExport.length} školení.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data do Excel.",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = () => {
    try {
      const trainingsToExport = selectedTrainings.size > 0
        ? filteredTrainings.filter(t => selectedTrainings.has(t.id))
        : filteredTrainings;

      if (trainingsToExport.length === 0) {
        toast({
          title: "Žádná data k exportu",
          description: "Nejsou k dispozici žádná školení pro export.",
          variant: "destructive",
        });
        return;
      }

      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 20;

      pdf.setFontSize(18);
      pdf.text('Seznam skoleni', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      pdf.setFontSize(10);
      const date = new Date().toLocaleDateString('cs-CZ');
      pdf.text(`Vygenerovano: ${date}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      const statusMap = {
        valid: "Platne",
        warning: "Brzy vyprsi",
        expired: "Prosle"
      };

      autoTable(pdf, {
        startY: yPosition,
        head: [['Stav', 'Platne do', 'Typ', 'Cislo', 'Jmeno', 'Stredisko', 'Skolitel', 'Firma']],
        body: trainingsToExport.map(t => [
          statusMap[t.status],
          new Date(t.date).toLocaleDateString("cs-CZ"),
          t.type,
          t.employeeNumber,
          t.employeeName,
          t.department,
          t.trainer || '-',
          t.company || '-'
        ]),
        theme: 'striped',
        headStyles: { 
          fillColor: [66, 66, 66],
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8
        },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 25 },
          2: { cellWidth: 45 },
          3: { cellWidth: 20 },
          4: { cellWidth: 40 },
          5: { cellWidth: 30 },
          6: { cellWidth: 35 },
          7: { cellWidth: 35 }
        },
        margin: { left: 10, right: 10 },
      });

      const timestamp = new Date().toISOString().split('T')[0];
      pdf.save(`skoleni_export_${timestamp}.pdf`);

      toast({
        title: "Export dokončen",
        description: `Exportováno ${trainingsToExport.length} školení.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data do PDF.",
        variant: "destructive",
      });
    }
  };

  if (trainingsError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Naplánovaná školení</h2>
        </div>
        <ErrorDisplay
          title="Nepodařilo se načíst školení"
          message={trainingsError}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (trainingsLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <TableSkeleton columns={10} rows={8} />
      </div>
    );
  }

  return (
    <>
      {previewFile && (
        <FilePreviewDialog
          open={true}
          onOpenChange={(open) => !open && setPreviewFile(null)}
          file={previewFile}
        />
      )}
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Naplánovaná školení</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Obnovit
            </Button>
            <Button 
              variant="outline" 
              onClick={() => selectExpiringTrainings(30)}
              title="Vybrat všechna školení, která vyprší do 30 dní"
            >
              <CalendarClock className="w-4 h-4 mr-2" />
              Vybrat expirující (30 dní)
            </Button>
            <Button variant="outline" onClick={exportToExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              {selectedTrainings.size > 0 
                ? `Export Excel (${selectedTrainings.size})`
                : "Export Excel"
              }
            </Button>
            <Button variant="outline" onClick={exportToPDF}>
              <FileDown className="w-4 h-4 mr-2" />
              {selectedTrainings.size > 0 
                ? `Export PDF (${selectedTrainings.size})`
                : "Export PDF"
              }
            </Button>
            <Button onClick={() => navigate("/new-training")}>
              <Plus className="w-4 h-4 mr-2" />
              Nové školení
            </Button>
          </div>
        </div>

        {/* Bulk actions */}
        {selectedTrainings.size > 0 && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <p className="text-sm font-medium">
                  Vybráno {selectedTrainings.size} školení
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTrainings(new Set())}
                >
                  Zrušit výběr
                </Button>
              </div>
              <div className="flex gap-2">
                <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="sm" onClick={handleBulkEdit}>
                      <Edit className="w-4 h-4 mr-2" />
                      Hromadná úprava
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Hromadná úprava školení</DialogTitle>
                      <DialogDescription>
                        Změny budou aplikovány na {selectedTrainings.size} školení.
                        Prázdná pole zůstanou beze změny.
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
                                !bulkEditData.lastTrainingDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarClock className="mr-2 h-4 w-4" />
                              {bulkEditData.lastTrainingDate ? (
                                format(bulkEditData.lastTrainingDate, "d. MMMM yyyy", { locale: cs })
                              ) : (
                                <span>Vyberte datum (ponechat prázdné pro beze změny)</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={bulkEditData.lastTrainingDate}
                              onSelect={(date) =>
                                setBulkEditData({ ...bulkEditData, lastTrainingDate: date })
                              }
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
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
                          value={bulkEditData.trainer}
                          onChange={(e) =>
                            setBulkEditData({ ...bulkEditData, trainer: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Firma</Label>
                        <Input
                          placeholder="Nová firma (ponechat prázdné pro beze změny)"
                          value={bulkEditData.company}
                          onChange={(e) =>
                            setBulkEditData({ ...bulkEditData, company: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Provozovna</Label>
                        <Select
                          value={bulkEditData.facility}
                          onValueChange={(value) =>
                            setBulkEditData({ ...bulkEditData, facility: value === "__none__" ? "" : value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Vyberte provozovnu (ponechat prázdné pro beze změny)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">-- Bez změny --</SelectItem>
                            {facilitiesData.map((f) => (
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
                          value={bulkEditData.note}
                          onChange={(e) =>
                            setBulkEditData({ ...bulkEditData, note: e.target.value })
                          }
                          rows={3}
                        />
                      </div>

                      <div className="space-y-3 border-t pt-4">
                        <Label>Soubory (PDF, dokumenty)</Label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              id="bulk-file-upload"
                              multiple
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                const MAX_FILE_SIZE = 10 * 1024 * 1024;
                                const ALLOWED_TYPES = [
                                  'application/pdf',
                                  'application/msword',
                                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                  'image/jpeg',
                                  'image/jpg',
                                  'image/png'
                                ];
                                
                                const errors: string[] = [];
                                const validFiles: File[] = [];
                                
                                files.forEach(file => {
                                  if (file.size > MAX_FILE_SIZE) {
                                    errors.push(`${file.name}: Příliš velký soubor (max 10MB)`);
                                    return;
                                  }
                                  
                                  const fileExtension = file.name.split('.').pop()?.toLowerCase();
                                  const isValidType = ALLOWED_TYPES.includes(file.type) ||
                                    ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(fileExtension || '');
                                  
                                  if (!isValidType) {
                                    errors.push(`${file.name}: Nepodporovaný typ souboru`);
                                    return;
                                  }
                                  
                                  validFiles.push(file);
                                });
                                
                                if (errors.length > 0) {
                                  toast({
                                    title: "Některé soubory nebyly přidány",
                                    description: errors.join(', '),
                                    variant: "destructive",
                                  });
                                }
                                
                                if (validFiles.length > 0) {
                                  setBulkEditData({
                                    ...bulkEditData,
                                    uploadedFiles: [...bulkEditData.uploadedFiles, ...validFiles],
                                  });
                                }
                                
                                e.target.value = '';
                              }}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById("bulk-file-upload")?.click()}
                              className="w-full"
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Nahrát soubory
                            </Button>
                          </div>

                          {bulkEditData.uploadedFiles.length > 0 && (
                            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold">
                                  Vybrané soubory ({bulkEditData.uploadedFiles.length})
                                </p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setBulkEditData({
                                      ...bulkEditData,
                                      uploadedFiles: [],
                                    });
                                  }}
                                  className="h-7 text-xs"
                                >
                                  Odebrat vše
                                </Button>
                              </div>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {bulkEditData.uploadedFiles.map((file, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-3 p-3 bg-background rounded-md border hover:border-primary/50 transition-colors"
                                  >
                                    <div className="flex-shrink-0">
                                      {getFileIcon(file.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate" title={file.name}>
                                        {file.name}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-muted-foreground">
                                          {formatFileSize(file.size)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setPreviewFile(file)}
                                        title="Náhled"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => {
                                          const newFiles = [...bulkEditData.uploadedFiles];
                                          newFiles.splice(idx, 1);
                                          setBulkEditData({
                                            ...bulkEditData,
                                            uploadedFiles: newFiles,
                                          });
                                        }}
                                        title="Odebrat"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-start space-x-2 pt-2 border-t">
                                <Checkbox
                                  id="replace-files"
                                  checked={bulkEditData.keepExistingFiles}
                                  onCheckedChange={(checked) =>
                                    setBulkEditData({
                                      ...bulkEditData,
                                      keepExistingFiles: checked as boolean,
                                    })
                                  }
                                  className="mt-0.5"
                                />
                                <div className="space-y-1">
                                  <Label
                                    htmlFor="replace-files"
                                    className="text-sm font-medium cursor-pointer leading-none"
                                  >
                                    Ponechat původní a nahrát nové k nim
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    Pokud není zaškrtnuto, původní soubory budou nahrazeny novými
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {isUploading && (
                            <div className="space-y-2 border-t pt-4">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Nahrávání souborů...</span>
                                <span className="font-medium">{uploadProgress}%</span>
                              </div>
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
                      <Button
                        variant="outline"
                        onClick={() => {
                          setBulkEditDialogOpen(false);
                          setBulkEditData({ 
                            trainer: "", 
                            company: "", 
                            note: "",
                            facility: "",
                            lastTrainingDate: undefined,
                            keepExistingFiles: false,
                            uploadedFiles: [],
                          });
                        }}
                        disabled={loading || isUploading}
                      >
                        Zrušit
                      </Button>
                      <Button onClick={applyBulkEdit} disabled={loading || isUploading}>
                        {isUploading ? (
                          <>
                            <Upload className="w-4 h-4 mr-2 animate-bounce" />
                            Nahrávání... {uploadProgress}%
                          </>
                        ) : loading ? (
                          "Ukládám..."
                        ) : (
                          "Aplikovat změny"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkArchive}
                    className="border-amber-500 text-amber-700 hover:bg-amber-50"
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Archivovat vybrané
                  </Button>
                  <AlertDialogContent className="max-w-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Potvrzení archivace školení</AlertDialogTitle>
                      <AlertDialogDescription>
                        Vybraná školení budou archivována. Zůstanou dostupná v Historii školení s možností obnovení.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="max-h-96 overflow-y-auto">
                      <div className="space-y-3 py-4">
                        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                          <div>Zaměstnanec</div>
                          <div>Typ školení</div>
                          <div>Datum</div>
                          <div>Stav</div>
                        </div>
                        {selectedTrainingDetails.map((training) => (
                          <div key={training.id} className="grid grid-cols-4 gap-2 text-sm border-b pb-2">
                            <div className="font-medium">
                              {training.employeeName}
                              <span className="text-xs text-muted-foreground block">
                                {training.employeeNumber}
                              </span>
                            </div>
                            <div>{training.type}</div>
                            <div className="text-xs">
                              {new Date(training.date).toLocaleDateString("cs-CZ")}
                            </div>
                            <div>
                              <StatusBadge status={training.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm font-medium text-amber-700">
                          Celkem bude archivováno: {selectedTrainings.size} školení
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Archivovaná školení lze zobrazit a obnovit v Historii školení.
                        </p>
                      </div>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Zrušit</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={confirmBulkArchive}
                        className="bg-amber-600 text-white hover:bg-amber-700"
                      >
                        Archivovat {selectedTrainings.size} školení
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        )}

        {/* Advanced filters */}
        <AdvancedFilters
          filters={filters}
          onFilterChange={updateFilter}
          onClearFilters={clearFilters}
          onSaveFilters={saveCurrentFilters}
          onLoadFilter={loadSavedFilter}
          onDeleteFilter={deleteSavedFilter}
          savedFilters={savedFilters}
          hasActiveFilters={hasActiveFilters}
          departments={departments}
          facilities={facilities}
          trainingTypes={trainingTypes}
          trainers={trainers}
          resultCount={filteredTrainings.length}
          totalCount={trainings.length}
        />

        {/* Legend + Count - above the table */}
        <div className="flex items-center justify-between">
          <StatusLegend variant="training" />
          <p className="text-sm text-muted-foreground">
            Celkem: {filteredTrainings.length} školení
          </p>
        </div>

        <Card className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredTrainings.length > 0 &&
                        selectedTrainings.size === filteredTrainings.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Školení platné do</TableHead>
                  <TableHead>Typ školení</TableHead>
                  
                  <TableHead>Jméno</TableHead>
                  <TableHead>Provozovna</TableHead>
                  <TableHead>Středisko</TableHead>
                  <TableHead>Datum školení</TableHead>
                  <TableHead>Školitel</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Zadavatel</TableHead>
                  <TableHead>Periodicita</TableHead>
                  <TableHead>Poznámka</TableHead>
                  <TableHead className="text-center">Protokol</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrainings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                      Žádná školení nenalezena
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTrainings.map((training) => (
                    <TableRow key={training.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTrainings.has(training.id)}
                          onCheckedChange={() => toggleSelectTraining(training.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={training.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(training.date).toLocaleDateString("cs-CZ")}
                      </TableCell>
                      <TableCell className="font-medium">{training.type}</TableCell>
                      
                      <TableCell className="whitespace-nowrap">{training.employeeName}</TableCell>
                      <TableCell className="max-w-xs truncate" title={getFacilityName(training.facility)}>
                        {getFacilityName(training.facility)}
                      </TableCell>
                      <TableCell>{training.department}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(training.lastTrainingDate).toLocaleDateString("cs-CZ")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{training.trainer}</TableCell>
                      <TableCell className="whitespace-nowrap">{training.company}</TableCell>
                      <TableCell className="whitespace-nowrap">{training.requester}</TableCell>
                      <TableCell className="text-center">
                        {formatPeriodicity(training.period)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={training.note}>
                        {training.note || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <TrainingProtocolCell trainingId={training.id} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/edit-training/${training.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

      </div>
    </>
  );
}
