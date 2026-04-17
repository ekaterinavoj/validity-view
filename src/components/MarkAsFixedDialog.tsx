import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Wrench, ChevronsUpDown, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEmployees } from "@/hooks/useEmployees";
import { cn } from "@/lib/utils";

export type FixedTarget = "trainings" | "deadlines";

interface MarkAsFixedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
  recordLabel?: string;
  target: FixedTarget;
  onSuccess?: () => void;
}

export function MarkAsFixedDialog({
  open,
  onOpenChange,
  recordId,
  recordLabel,
  target,
  onSuccess,
}: MarkAsFixedDialogProps) {
  const { toast } = useToast();
  const { employees } = useEmployees();
  const [fixedDate, setFixedDate] = useState<Date | undefined>(new Date());
  const [mode, setMode] = useState<"employee" | "manual">("employee");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [manualName, setManualName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false);

  const employeeOptions = useMemo(
    () =>
      employees.map((e) => ({
        id: e.id,
        label: `${e.firstName} ${e.lastName}${e.employeeNumber ? ` (${e.employeeNumber})` : ""}`,
      })),
    [employees],
  );

  const reset = () => {
    setFixedDate(new Date());
    setMode("employee");
    setSelectedEmployeeId("");
    setManualName("");
    setNote("");
  };

  const handleClose = (next: boolean) => {
    if (!submitting) {
      onOpenChange(next);
      if (!next) reset();
    }
  };

  const handleSubmit = async () => {
    if (!recordId) return;
    if (!fixedDate) {
      toast({ title: "Chybí datum opravy", variant: "destructive" });
      return;
    }

    let fixedByName: string | null = null;
    let fixedByProfileId: string | null = null;

    if (mode === "employee") {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      if (!emp) {
        toast({ title: "Vyberte zaměstnance", variant: "destructive" });
        return;
      }
      fixedByName = `${emp.firstName} ${emp.lastName}`.trim();
      // Try to find linked profile for the chosen employee (for proper FK linkage)
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("employee_id", emp.id)
        .maybeSingle();
      fixedByProfileId = profile?.id ?? null;
    } else {
      const trimmed = manualName.trim();
      if (!trimmed) {
        toast({ title: "Zadejte jméno opravujícího", variant: "destructive" });
        return;
      }
      fixedByName = trimmed;
    }

    setSubmitting(true);
    try {
      const update: Record<string, unknown> = {
        fixed_at: format(fixedDate, "yyyy-MM-dd"),
        fixed_by_name: fixedByName,
        fixed_by_profile_id: fixedByProfileId,
        fixed_note: note.trim() || null,
        status: "valid",
      };

      const { error } = await supabase.from(target).update(update).eq("id", recordId);
      if (error) throw error;

      toast({ title: "Záznam označen jako opraveno", description: recordLabel ?? undefined });
      onSuccess?.();
      handleClose(false);
    } catch (err: any) {
      console.error("Mark-as-fixed failed:", err);
      toast({ title: "Chyba při ukládání", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-status-valid" />
            Označit jako opraveno
          </DialogTitle>
          <DialogDescription>
            {recordLabel
              ? `Záznam: ${recordLabel}`
              : "Záznam bude označen za platný a doplněn o údaje o opravě."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Datum opravy</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !fixedDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fixedDate ? format(fixedDate, "dd.MM.yyyy") : "Vyberte datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fixedDate}
                  onSelect={setFixedDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Opravil</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "employee" | "manual")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="employee" id="fix-mode-employee" />
                <Label htmlFor="fix-mode-employee" className="font-normal cursor-pointer">
                  Vybrat zaměstnance
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manual" id="fix-mode-manual" />
                <Label htmlFor="fix-mode-manual" className="font-normal cursor-pointer">
                  Zadat ručně
                </Label>
              </div>
            </RadioGroup>

            {mode === "employee" ? (
              <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {selectedEmployeeId
                      ? employeeOptions.find((e) => e.id === selectedEmployeeId)?.label
                      : "Vyberte zaměstnance..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[460px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Hledat..." />
                    <CommandList>
                      <CommandEmpty>Nenalezeno.</CommandEmpty>
                      <CommandGroup>
                        {employeeOptions.map((opt) => (
                          <CommandItem
                            key={opt.id}
                            value={opt.label}
                            onSelect={() => {
                              setSelectedEmployeeId(opt.id);
                              setEmployeePopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedEmployeeId === opt.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {opt.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              <Input
                placeholder="Jméno externího pracovníka, firmy apod."
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fix-note">Poznámka (volitelné)</Label>
            <Textarea
              id="fix-note"
              placeholder="Co bylo opraveno, zjednáno atd."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            Zrušit
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Ukládá se..." : "Označit jako opraveno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
