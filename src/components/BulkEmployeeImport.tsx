import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertCircle, CheckCircle, X, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { z } from 'zod';

const employeeSchema = z.object({
  firstName: z.string().min(1, "Jméno je povinné").max(100),
  lastName: z.string().min(1, "Příjmení je povinné").max(100),
  email: z.string().email("Neplatný email").max(255),
  employeeNumber: z.string().min(1, "Osobní číslo je povinné").max(50),
  position: z.string().min(1, "Pozice je povinná").max(100),
  department: z.string().min(1, "Středisko je povinné").max(50),
  status: z.enum(["employed", "parental_leave", "sick_leave", "terminated"]),
});

interface ImportedEmployee {
  data: any;
  isValid: boolean;
  errors: string[];
  rowNumber: number;
}

export function BulkEmployeeImport() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importedData, setImportedData] = useState<ImportedEmployee[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validace velikosti souboru
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      toast({
        title: "Soubor je příliš velký",
        description: "Maximální velikost souboru je 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          const validatedData: ImportedEmployee[] = jsonData.map((row: any, index) => {
            const employeeData = {
              firstName: row['Jméno'] || row['firstName'] || '',
              lastName: row['Příjmení'] || row['lastName'] || '',
              email: row['Email'] || row['email'] || '',
              employeeNumber: row['Osobní číslo'] || row['employeeNumber'] || '',
              position: row['Pozice'] || row['position'] || '',
              department: row['Středisko'] || row['department'] || '',
              status: (row['Stav'] || row['status'] || 'employed').toLowerCase(),
            };

            const validation = employeeSchema.safeParse(employeeData);
            
            return {
              data: employeeData,
              isValid: validation.success,
              errors: validation.success ? [] : validation.error.errors.map(e => e.message),
              rowNumber: index + 2, // +2 protože Excel řádky začínají od 1 a první je header
            };
          });

          setImportedData(validatedData);
          setDialogOpen(true);

          const validCount = validatedData.filter(d => d.isValid).length;
          const invalidCount = validatedData.length - validCount;

          toast({
            title: "Soubor načten",
            description: `Načteno ${validatedData.length} záznamů. ${validCount} platných, ${invalidCount} s chybami.`,
          });
        } catch (error) {
          toast({
            title: "Chyba při zpracování souboru",
            description: "Soubor nemá správný formát.",
            variant: "destructive",
          });
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      toast({
        title: "Chyba při načítání souboru",
        description: "Nepodařilo se načíst soubor.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleImport = () => {
    const validData = importedData.filter(d => d.isValid);
    
    // TODO: Zde by se data uložila do databáze
    console.log('Importing:', validData.map(d => d.data));
    
    toast({
      title: "Import dokončen",
      description: `Importováno ${validData.length} zaměstnanců.`,
    });
    
    setDialogOpen(false);
    setImportedData([]);
  };

  const handleReImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast({
        title: "Soubor je příliš velký",
        description: "Maximální velikost souboru je 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          const validatedData: ImportedEmployee[] = jsonData.map((row: any, index) => {
            const employeeData = {
              firstName: row['Jméno'] || row['firstName'] || '',
              lastName: row['Příjmení'] || row['lastName'] || '',
              email: row['Email'] || row['email'] || '',
              employeeNumber: row['Osobní číslo'] || row['employeeNumber'] || '',
              position: row['Pozice'] || row['position'] || '',
              department: row['Středisko'] || row['department'] || '',
              status: (row['Stav'] || row['status'] || 'employed').toLowerCase(),
            };

            const validation = employeeSchema.safeParse(employeeData);
            
            return {
              data: employeeData,
              isValid: validation.success,
              errors: validation.success ? [] : validation.error.errors.map(e => e.message),
              rowNumber: index + 2,
            };
          });

          setImportedData(validatedData);

          const validCount = validatedData.filter(d => d.isValid).length;
          const invalidCount = validatedData.length - validCount;

          toast({
            title: "Soubor znovu načten",
            description: `Načteno ${validatedData.length} záznamů. ${validCount} platných, ${invalidCount} s chybami.`,
          });
        } catch (error) {
          toast({
            title: "Chyba při zpracování souboru",
            description: "Soubor nemá správný formát.",
            variant: "destructive",
          });
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      toast({
        title: "Chyba při načítání souboru",
        description: "Nepodařilo se načíst soubor.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const exportErrors = () => {
    const errorData = importedData
      .filter(d => !d.isValid)
      .map(d => ({
        ...d.data,
        _chyby: d.errors.join('; '),
        _radek: d.rowNumber,
      }));

    if (errorData.length === 0) {
      toast({
        title: "Žádné chyby",
        description: "Nejsou k dispozici žádné chybné záznamy k exportu.",
      });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(errorData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chyby");
    
    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `chyby_import_zamestnanci_${timestamp}.xlsx`);

    toast({
      title: "Export dokončen",
      description: `Exportováno ${errorData.length} chybných záznamů. Po opravě můžete soubor znovu nahrát.`,
    });
  };

  const validCount = importedData.filter(d => d.isValid).length;
  const invalidCount = importedData.length - validCount;

  return (
    <>
      <input
        type="file"
        id="employee-import"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={() => document.getElementById('employee-import')?.click()}
        disabled={isProcessing}
      >
        <Upload className="w-4 h-4 mr-2" />
        {isProcessing ? "Zpracovávám..." : "Import z Excel/CSV"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Náhled importu zaměstnanců</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium">{validCount} platných</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <span className="font-medium">{invalidCount} s chybami</span>
              </div>
              {invalidCount > 0 && (
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportErrors}
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Exportovat chyby
                  </Button>
                  <input
                    type="file"
                    id="employee-reimport"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleReImport}
                    className="hidden"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => document.getElementById('employee-reimport')?.click()}
                    disabled={isProcessing}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isProcessing ? "Zpracovávám..." : "Nahrát opravený soubor"}
                  </Button>
                </div>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[50vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Ř.</TableHead>
                      <TableHead>Jméno</TableHead>
                      <TableHead>Příjmení</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Os. číslo</TableHead>
                      <TableHead>Pozice</TableHead>
                      <TableHead>Středisko</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importedData.map((item, index) => (
                      <TableRow key={index} className={!item.isValid ? "bg-destructive/5" : ""}>
                        <TableCell className="font-mono text-xs">{item.rowNumber}</TableCell>
                        <TableCell>{item.data.firstName}</TableCell>
                        <TableCell>{item.data.lastName}</TableCell>
                        <TableCell className="text-sm">{item.data.email}</TableCell>
                        <TableCell className="font-mono">{item.data.employeeNumber}</TableCell>
                        <TableCell className="text-sm">{item.data.position}</TableCell>
                        <TableCell className="font-mono text-sm">{item.data.department}</TableCell>
                        <TableCell>
                          {item.isValid ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <X className="w-3 h-3 mr-1" />
                              Chyba
                            </Badge>
                          )}
                          {!item.isValid && (
                            <div className="text-xs text-destructive mt-1">
                              {item.errors.join(", ")}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Zrušit
              </Button>
              <Button 
                onClick={handleImport}
                disabled={validCount === 0}
              >
                Importovat {validCount > 0 && `(${validCount})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
