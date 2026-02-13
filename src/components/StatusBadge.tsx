import { cn } from "@/lib/utils";

export type TrainingStatus = "valid" | "warning" | "expired";

interface StatusBadgeProps {
  status: TrainingStatus;
  className?: string;
}

const statusConfig = {
  valid: {
    label: "Platné",
    className: "bg-status-valid text-status-valid-foreground",
  },
  warning: {
    label: "Brzy vyprší",
    className: "bg-status-warning text-status-warning-foreground",
  },
  expired: {
    label: "Prošlé",
    className: "bg-status-expired text-status-expired-foreground",
  },
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const config = statusConfig[status] ?? {
    label: status || "—",
    className: "bg-muted text-muted-foreground",
  };
  
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-block w-3 h-3 rounded-full",
          config.className
        )}
      />
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  );
};
