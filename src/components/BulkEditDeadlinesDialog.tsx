import { useState } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarClock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFacilities } from "@/hooks/useFacilities";

interface BulkEditDeadlinesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSuccess: () => void;
}

export function BulkEditDeadlinesDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: BulkEditDeadlinesDialogProps) {
  const { toast } = useToast();
  const { facilities } = useFacilities();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    performer: "",
    company: "",
    note: "",
    facility: "",
    lastCheckDate: undefined as Date | undefined,
  });

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;

    setLoading(true);
    try {
      const updates: Record<string, any> = {};
      
      if (formData.performer.trim()) {
        updates.performer = formData.performer.trim();
      }
      if (formData.company.trim()) {
        updates.company = formData.company.trim();
      }
      if (formData.note.trim()) {
        updates.note = formData.note.trim();
      }
      if (formData.facility) {
        updates.facility = formData.facility;
      }
      if (formData.lastCheckDate) {
        updates.last_check_date = format(formData.lastCheckDate, "yyyy-MM-dd");
      }

      if (Object.keys(updates).length === 0) {
        toast({
          title: "Žádné změny",
          description: "Nevyplnili jste žádné pole pro úpravu.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // If last_check_date is updated, we need to recalculate next_check_date for each deadline
      if (formData.lastCheckDate) {
        for (const deadlineId of selectedIds) {
          const { data: deadline, error: fetchError } = await supabase
            .from("deadlines")
            .select("deadline_type_id, deadline_types(period_days)")
            .eq("id", deadlineId)
            .single();

          if (fetchError) throw fetchError;

          const periodDays = (deadline as any).deadline_types?.period_days || 365;
          const nextDate = new Date(formData.lastCheckDate);
          nextDate.setDate(nextDate.getDate() + periodDays);

          const individualUpdates = {
            ...updates,
            next_check_date: format(nextDate, "yyyy-MM-dd"),
          };

          const { error: updateError } = await supabase
            .from("deadlines")
            .update(individualUpdates)
            .eq("id", deadlineId);

          if (updateError) throw updateError;
        }
      } else {
        const { error } = await supabase
          .from("deadlines")
          .update(updates)
          .in("id", selectedIds);

        if (error) throw error;
      }

      toast({
        title: "Hromadná úprava provedena",
        description: `Úspěšně aktualizováno ${selectedIds.length} událostí.`,
      });

      onOpenChange(false);
      setFormData({
        performer: "",
        company: "",
        note: "",
        facility: "",
        lastCheckDate: undefined,
      });
      onSuccess();
    } catch (error: any) {
      console.error("Error in bulk edit:", error);
      toast({
        title: "Chyba při hromadné úpravě",
        description: error.message || "Nepodařilo se aktualizovat události.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hromadná úprava událostí</DialogTitle>
          <DialogDescription>
            Změny budou aplikovány na {selectedIds.length} událostí.
            Prázdná pole zůstanou beze změny.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Datum poslední kontroly</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.lastCheckDate && "text-muted-foreground"
                  )}
                >
                  <CalendarClock className="mr-2 h-4 w-4" />
                  {formData.lastCheckDate ? (
                    format(formData.lastCheckDate, "d. MMMM yyyy", { locale: cs })
                  ) : (
                    <span>Vyberte datum (ponechat prázdné pro beze změny)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.lastCheckDate}
                  onSelect={(date) => setFormData({ ...formData, lastCheckDate: date })}
                  locale={cs}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-performer">Provádějící</Label>
            <Input
              id="bulk-performer"
              value={formData.performer}
              onChange={(e) => setFormData({ ...formData, performer: e.target.value })}
              placeholder="Ponechat prázdné pro beze změny"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-company">Firma</Label>
            <Input
              id="bulk-company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Ponechat prázdné pro beze změny"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-facility">Provozovna</Label>
            <Select
              value={formData.facility}
              onValueChange={(value) => setFormData({ ...formData, facility: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ponechat beze změny" />
              </SelectTrigger>
              <SelectContent>
                {facilities.map((f) => (
                  <SelectItem key={f.code} value={f.code}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-note">Poznámka</Label>
            <Textarea
              id="bulk-note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="Ponechat prázdné pro beze změny"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Zrušit
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Uložit změny
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
