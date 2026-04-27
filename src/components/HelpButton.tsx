import { Link } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HelpButtonProps {
  /** Anchor of the section in /guides (without the leading #). E.g. "skoleni" → /guides#skoleni */
  section: string;
  /** Tooltip / aria label shown on hover. */
  label?: string;
  /** Optional className to fine-tune placement. */
  className?: string;
}

/**
 * Kontextové tlačítko „Nápověda“.
 *
 * Odkazuje uživatele do správné kapitoly průvodce na stránce /guides
 * a používá hash-anchor pro automatické scrollování.
 *
 * Používá se v PageHeader (action) všech hlavních modulů.
 */
export function HelpButton({ section, label = "Nápověda k této stránce", className }: HelpButtonProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={label}
            className={className}
          >
            <Link to={`/guides#${section}`}>
              <HelpCircle className="h-5 w-5 text-muted-foreground hover:text-primary" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
