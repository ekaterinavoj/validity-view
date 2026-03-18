import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, format, setMonth, setYear } from "date-fns";
import { cs } from "date-fns/locale";
import { CaptionProps, DayPicker, useNavigation } from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const MONTHS = Array.from({ length: 12 }, (_, monthIndex) => ({
  value: monthIndex,
  label: format(new Date(2026, monthIndex, 1), "LLLL", { locale: cs }),
}));

function CalendarCaption({ displayMonth }: CaptionProps) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();
  const [yearInput, setYearInput] = React.useState(String(displayMonth.getFullYear()));

  React.useEffect(() => {
    setYearInput(String(displayMonth.getFullYear()));
  }, [displayMonth]);

  const handleMonthChange = (month: number) => {
    goToMonth(setMonth(displayMonth, month));
  };

  const commitYearChange = () => {
    const parsedYear = Number.parseInt(yearInput, 10);
    if (Number.isNaN(parsedYear)) {
      setYearInput(String(displayMonth.getFullYear()));
      return;
    }

    const nextDate = setYear(displayMonth, parsedYear);
    setYearInput(String(nextDate.getFullYear()));
    goToMonth(nextDate);
  };

  return (
    <div className="flex items-center justify-between gap-2 px-1 pb-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
        onClick={() => previousMonth && goToMonth(addMonths(displayMonth, -1))}
        disabled={!previousMonth}
        aria-label="Předchozí měsíc"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded-full px-3 text-sm font-medium capitalize hover:bg-accent"
          >
            {format(displayMonth, "LLLL yyyy", { locale: cs })}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-[280px] rounded-2xl border-border/60 p-3 shadow-lg">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((month) => {
                const isActive = displayMonth.getMonth() === month.value;

                return (
                  <Button
                    key={month.value}
                    type="button"
                    variant={isActive ? "default" : "ghost"}
                    className="h-9 rounded-xl px-2 text-xs capitalize"
                    onClick={() => handleMonthChange(month.value)}
                  >
                    {month.label}
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Rok</span>
              <input
                type="number"
                inputMode="numeric"
                value={yearInput}
                onChange={(event) => setYearInput(event.target.value)}
                onBlur={commitYearChange}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitYearChange();
                  }
                }}
                className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label="Vybrat rok"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
        onClick={() => nextMonth && goToMonth(addMonths(displayMonth, 1))}
        disabled={!nextMonth}
        aria-label="Další měsíc"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  fromYear = 1940,
  toYear = new Date().getFullYear() + 20,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={cs}
      showOutsideDays={showOutsideDays}
      captionLayout="buttons"
      fromYear={fromYear}
      toYear={toYear}
      className={cn("p-3 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden",
        nav: "hidden",
        table: "w-full border-collapse",
        head_row: "flex justify-between",
        head_cell: "text-muted-foreground w-9 text-center font-normal text-[0.75rem]",
        row: "mt-1.5 flex w-full justify-between",
        cell: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected].day-range-end)]:rounded-r-full [&:has([aria-selected])]:rounded-full",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 rounded-full p-0 font-normal text-foreground aria-selected:opacity-100"),
        day_range_end: "day-range-end",
        day_selected:
          "rounded-full bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "rounded-full border border-border bg-transparent text-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-45 aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:opacity-100",
        day_disabled: "text-muted-foreground opacity-35",
        day_range_middle: "rounded-full aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CalendarCaption,
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
