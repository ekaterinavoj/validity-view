import { AlertCircle, RefreshCw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ErrorDisplayProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showContactAdmin?: boolean;
}

export function ErrorDisplay({
  title = "Nastala chyba",
  message = "Nepodařilo se načíst data. Zkuste to prosím znovu.",
  onRetry,
  showContactAdmin = true,
}: ErrorDisplayProps) {
  return (
    <Card className="p-8">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <div className="p-4 bg-destructive/10 rounded-full">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-md">{message}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {onRetry && (
            <Button onClick={onRetry} variant="default">
              <RefreshCw className="w-4 h-4 mr-2" />
              Zkusit znovu
            </Button>
          )}
          
          {showContactAdmin && (
            <Button variant="outline" asChild>
              <a href="mailto:admin@company.cz">
                <Mail className="w-4 h-4 mr-2" />
                Kontaktovat správce
              </a>
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          Pokud problém přetrvává, kontaktujte prosím technickou podporu.
        </p>
      </div>
    </Card>
  );
}

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title = "Žádná data",
  message = "Zatím zde nejsou žádné záznamy.",
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
      {icon && (
        <div className="p-4 bg-muted rounded-full">
          {icon}
        </div>
      )}
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
      </div>

      {action && (
        <Button onClick={action.onClick} variant="default">
          {action.label}
        </Button>
      )}
    </div>
  );
}
