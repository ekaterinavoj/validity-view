import { ReactNode } from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Unified empty-state block used inside cards/tables across the app
 * so that "no data" presentation is identical for all roles.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title = "Žádné záznamy",
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-10 px-4 gap-2", className)}>
      <Icon className="h-10 w-10 text-muted-foreground/60" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-md">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
