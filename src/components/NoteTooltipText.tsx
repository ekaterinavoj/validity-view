import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NoteTooltipTextProps {
  note?: string | null;
  emptyLabel?: string;
  className?: string;
}

export function NoteTooltipText({
  note,
  emptyLabel = "-",
  className,
}: NoteTooltipTextProps) {
  if (!note) {
    return <span className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "block max-w-[200px] cursor-help truncate text-sm text-muted-foreground",
              className,
            )}
          >
            {note}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm whitespace-pre-wrap break-words">{note}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
