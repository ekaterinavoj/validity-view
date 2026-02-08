import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Column {
  name: string;
  description: string;
}

interface ImportDescriptionProps {
  requiredColumns: Column[];
  optionalColumns?: Column[];
  duplicateInfo: string;
  csvInfo?: string;
}

export const ImportDescription = ({
  requiredColumns,
  optionalColumns,
  duplicateInfo,
  csvInfo = "Delimiter: středník (;), kódování: UTF-8 s BOM"
}: ImportDescriptionProps) => {
  return (
    <Alert className="bg-muted/50 border-muted">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="space-y-3">
        <div>
          <p className="font-semibold text-foreground mb-1">Povinné sloupce:</p>
          <ul className="list-disc list-inside space-y-0.5 text-sm">
            {requiredColumns.map((col) => (
              <li key={col.name}>
                <span className="font-medium">{col.name}</span> – {col.description}
              </li>
            ))}
          </ul>
        </div>
        
        {optionalColumns && optionalColumns.length > 0 && (
          <div>
            <p className="font-semibold text-foreground mb-1">Nepovinné sloupce:</p>
            <ul className="list-disc list-inside space-y-0.5 text-sm">
              {optionalColumns.map((col) => (
                <li key={col.name}>
                  <span className="font-medium">{col.name}</span> – {col.description}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <p className="text-sm">
          <span className="font-semibold text-foreground">Duplicita:</span> {duplicateInfo}
        </p>
        
        <p className="text-sm">
          <span className="font-semibold text-foreground">CSV formát:</span> {csvInfo}
        </p>
      </AlertDescription>
    </Alert>
  );
};
