import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Unified page header used across primary list/overview pages.
 * Keeps icon size, typography, gaps and description colour consistent
 * regardless of role (Admin / Manager / User).
 */
export function PageHeader({ icon: Icon, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2 mb-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {Icon && <Icon className="h-6 w-6 text-engel-blue shrink-0 mt-1" />}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
