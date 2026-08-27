import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { MissingHeader } from "@/lib/importValidation";

interface MissingHeadersAlertProps {
  missing: MissingHeader[];
  detected?: string[];
}

/**
 * Inline alert highlighting which CSV columns are missing or incorrectly named,
 * along with the accepted alias names the user can use.
 *
 * Used in bulk-import dialogs after the user uploads a file with mismatched headers.
 */
export const MissingHeadersAlert = ({ missing, detected }: MissingHeadersAlertProps) => {
  if (missing.length === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Chybí povinné sloupce</AlertTitle>
      <AlertDescription className="space-y-3 mt-2">
        <p className="text-sm">
          Soubor neobsahuje následující povinné sloupce. Prosím, doplňte je do
          hlavičky CSV (přijatelné názvy jsou uvedené v závorkách):
        </p>
        <ul className="space-y-2">
          {missing.map((m) => (
            <li key={m.canonical} className="flex flex-wrap items-center gap-2">
              <Badge variant="destructive" className="font-mono text-xs">
                {m.canonical}
              </Badge>
              <span className="text-xs text-muted-foreground">
                přijatelné názvy:
              </span>
              {m.expected.map((alias) => (
                <Badge
                  key={alias}
                  variant="outline"
                  className="font-mono text-xs"
                >
                  {alias}
                </Badge>
              ))}
            </li>
          ))}
        </ul>
        {detected && detected.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Zobrazit nalezené sloupce v souboru ({detected.length})
            </summary>
            <div className="mt-2 flex flex-wrap gap-1">
              {detected.map((h) => (
                <Badge key={h} variant="secondary" className="font-mono text-xs">
                  {h}
                </Badge>
              ))}
            </div>
          </details>
        )}
      </AlertDescription>
    </Alert>
  );
};
