import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { cs } from "date-fns/locale";

export type EmployeeStatus = "employed" | "parental_leave" | "sick_leave" | "terminated";

interface EmployeeStatusBadgeProps {
  status: EmployeeStatus;
  statusStartDate?: string;
  className?: string;
}

const statusConfig: Record<EmployeeStatus, { label: string; className: string }> = {
  employed: {
    label: "Aktivní",
    className: "bg-status-valid text-status-valid-foreground",
  },
  parental_leave: {
    label: "Mateřská/rodičovská",
    className: "bg-status-warning text-status-warning-foreground",
  },
  sick_leave: {
    label: "Nemocenská",
    className: "bg-status-sick text-status-sick-foreground",
  },
  terminated: {
    label: "Ukončený",
    className: "bg-status-terminated text-status-terminated-foreground",
  },
};

export const EmployeeStatusBadge = ({ status, statusStartDate, className }: EmployeeStatusBadgeProps) => {
  const config = statusConfig[status];
  
  // Format date if available and status is not "employed"
  const formattedDate = statusStartDate && status !== "employed"
    ? format(parseISO(statusStartDate), "d.M.yyyy", { locale: cs })
    : null;
  
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-block w-2.5 h-2.5 rounded-full",
          config.className
        )}
      />
      <span className="text-sm font-medium">
        {config.label}
        {formattedDate && (
          <span className="text-xs text-muted-foreground ml-1">
            (od {formattedDate})
          </span>
        )}
      </span>
    </div>
  );
};

export const EmployeeStatusLegend = () => {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      {(Object.keys(statusConfig) as EmployeeStatus[]).map((status) => (
        <div key={status} className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block w-2.5 h-2.5 rounded-full",
              statusConfig[status].className
            )}
          />
          <span className="text-muted-foreground">{statusConfig[status].label}</span>
        </div>
      ))}
    </div>
  );
};
