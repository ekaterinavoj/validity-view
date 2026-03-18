import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HEALTH_RISK_FIELDS, HEALTH_RISK_VALUES, type HealthRiskValue, type HealthRisks } from "@/lib/healthRisks";

interface HealthRisksSectionProps {
  value: HealthRisks;
  onChange: (value: HealthRisks) => void;
  disabled?: boolean;
}

export function HealthRisksSection({ value, onChange, disabled = false }: HealthRisksSectionProps) {
  const handleValueChange = (key: keyof HealthRisks, nextValue: string) => {
    onChange({
      ...value,
      [key]: nextValue ? (nextValue as HealthRiskValue) : null,
    });
  };

  return (
    <section className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Zdravotní rizika</h3>
        <p className="text-sm text-muted-foreground">
          U každé kategorie vyberte jednu hodnotu nebo nechte bez výběru.
        </p>
      </div>

      <div className="space-y-3">
        {HEALTH_RISK_FIELDS.map((field) => (
          <div
            key={field.key}
            className="grid gap-2 md:grid-cols-[240px_minmax(0,1fr)] md:items-center"
          >
            <div className="text-sm font-medium text-foreground">{field.label}</div>

            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={value[field.key] ?? ""}
              onValueChange={(nextValue) => handleValueChange(field.key, nextValue)}
              className="flex-wrap justify-start"
            >
              {HEALTH_RISK_VALUES.map((option) => (
                <ToggleGroupItem
                  key={`${field.key}-${option}`}
                  value={option}
                  disabled={disabled}
                  aria-label={`${field.label} ${option}`}
                  className="min-w-12 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {option}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
    </section>
  );
}
