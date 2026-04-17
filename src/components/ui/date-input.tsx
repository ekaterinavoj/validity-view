import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateInputProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Disable individual days (passed to Calendar) */
  disabledDates?: (date: Date) => boolean;
  /** Visual & ARIA invalid state */
  invalid?: boolean;
  id?: string;
  name?: string;
  /** Allowed input formats; first one is used for display */
  formats?: string[];
}

const DEFAULT_FORMATS = [
  "dd.MM.yyyy",
  "d.M.yyyy",
  "dd.MM.yy",
  "d.M.yy",
  "dd/MM/yyyy",
  "yyyy-MM-dd",
];

function parseLooseDate(input: string, formats: string[]): Date | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  for (const fmt of formats) {
    const parsed = parse(trimmed, fmt, new Date(), { locale: cs });
    if (isValid(parsed)) return parsed;
  }
  return undefined;
}

/**
 * DateInput
 *
 * Accessible date field that combines a typed text input (Czech format `dd.MM.yyyy`)
 * with a popover Calendar trigger. The user can either type the date manually or
 * pick it from the calendar.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      value,
      onChange,
      disabled,
      placeholder = "dd.mm.rrrr",
      className,
      inputClassName,
      disabledDates,
      invalid,
      id,
      name,
      formats = DEFAULT_FORMATS,
    },
    ref,
  ) => {
    const displayFormat = formats[0] ?? "dd.MM.yyyy";
    const [open, setOpen] = React.useState(false);
    const [text, setText] = React.useState<string>(
      value && isValid(value) ? format(value, displayFormat) : "",
    );

    // Sync external value -> local text whenever the parent updates the date.
    React.useEffect(() => {
      if (value && isValid(value)) {
        const formatted = format(value, displayFormat);
        setText((prev) => (prev === formatted ? prev : formatted));
      } else {
        setText("");
      }
    }, [value, displayFormat]);

    const commitText = (raw: string) => {
      if (!raw.trim()) {
        onChange?.(undefined);
        return;
      }
      const parsed = parseLooseDate(raw, formats);
      if (parsed && (!disabledDates || !disabledDates(parsed))) {
        onChange?.(parsed);
        setText(format(parsed, displayFormat));
      } else {
        // Revert text to last valid value
        if (value && isValid(value)) {
          setText(format(value, displayFormat));
        } else {
          setText("");
        }
      }
    };

    return (
      <div className={cn("relative flex w-full items-center", className)}>
        <Input
          ref={ref}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText((e.target as HTMLInputElement).value);
            }
          }}
          className={cn("pr-10", inputClassName)}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label="Otevřít kalendář"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={value}
              onSelect={(date) => {
                onChange?.(date ?? undefined);
                if (date) setText(format(date, displayFormat));
                setOpen(false);
              }}
              disabled={disabledDates}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
DateInput.displayName = "DateInput";
