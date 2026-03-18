import { Badge } from "@/components/ui/badge";
import { fromDbHealthRisks, getSelectedHealthRiskItems } from "@/lib/healthRisks";

interface HealthRisksSummaryProps {
  value: unknown;
}

export function HealthRisksSummary({ value }: HealthRisksSummaryProps) {
  const selectedItems = getSelectedHealthRiskItems(fromDbHealthRisks(value));

  if (selectedItems.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {selectedItems.map((item) => (
        <Badge key={item.key} variant="secondary" className="w-fit whitespace-nowrap text-xs">
          {item.label} {item.value}
        </Badge>
      ))}
    </div>
  );
}
