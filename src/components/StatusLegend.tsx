import { cn } from "@/lib/utils";

export type LegendVariant = "training" | "deadline" | "employee";

interface StatusLegendProps {
  variant: LegendVariant;
  className?: string;
}

const legendConfig: Record<LegendVariant, Array<{ label: string; className: string }>> = {
  training: [
    { label: "Platné", className: "bg-status-valid" },
    { label: "Brzy vyprší (30 dní)", className: "bg-status-warning" },
    { label: "Prošlé", className: "bg-status-expired" },
  ],
  deadline: [
    { label: "Platná", className: "bg-status-valid" },
    { label: "Vyprší do 30 dnů", className: "bg-status-warning" },
    { label: "Prošlá", className: "bg-status-expired" },
  ],
  employee: [
    { label: "Aktivní", className: "bg-status-valid" },
    { label: "Mateřská/rodičovská", className: "bg-status-warning" },
    { label: "Nemocenská", className: "bg-status-sick" },
    { label: "Ukončený", className: "bg-status-terminated" },
  ],
};

export function StatusLegend({ variant, className }: StatusLegendProps) {
  const items = legendConfig[variant];

  return (
    <div className={cn("flex flex-wrap items-center gap-4 text-sm", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block w-2.5 h-2.5 rounded-full",
              item.className
            )}
          />
          <span className="text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
