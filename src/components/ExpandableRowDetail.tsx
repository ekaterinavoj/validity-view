import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

interface DetailField {
  label: string;
  value: string | number | null | undefined;
}

interface ExpandableToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function ExpandableToggle({ isExpanded, onToggle }: ExpandableToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}

interface ExpandableDetailRowProps {
  colSpan: number;
  fields: DetailField[];
}

export function ExpandableDetailRow({ colSpan, fields }: ExpandableDetailRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0 border-t-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 p-4 bg-muted/40 border-t">
          {fields.map((field, i) => (
            <div key={i}>
              <p className="text-xs text-muted-foreground">{field.label}</p>
              <p className="text-sm font-medium">
                {field.value != null && field.value !== "" ? field.value : "—"}
              </p>
            </div>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}
