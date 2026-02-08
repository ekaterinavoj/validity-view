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

interface BulkEditExaminationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSuccess: () => void;
}

export function BulkEditExaminationsDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: BulkEditExaminationsDialogProps) {
  const { toast } = useToast();
  const { facilities } = useFacilities();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    doctor: "",
    medicalFacility: "",
    result: "",
    note: "",
    facility: "",
    lastExaminationDate: undefined as Date | undefined,
  });

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;

    setLoading(true);
    try {
      const updates: Record<string, any> = {};
      
      if (formData.doctor.trim()) {
        updates.doctor = formData.doctor.trim();
      }
      if (formData.medicalFacility.trim()) {
        updates.medical_facility = formData.medicalFacility.trim();
      }
      if (formData.result.trim()) {
        updates.result = formData.result.trim();
      }
      if (formData.note.trim()) {
        updates.note = formData.note.trim();
      }
      if (formData.facility) {
        updates.facility = formData.facility;
      }
      if (formData.lastExaminationDate) {
        updates.last_examination_date = format(formData.lastExaminationDate, "yyyy-MM-dd");
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

      // If last_examination_date is updated, we need to recalculate next_examination_date for each examination
      if (formData.lastExaminationDate) {
        for (const examinationId of selectedIds) {
          const { data: examination, error: fetchError } = await supabase
            .from("medical_examinations")
            .select("examination_type_id, medical_examination_types(period_days)")
            .eq("id", examinationId)
            .single();

          if (fetchError) throw fetchError;

          const periodDays = (examination as any).medical_examination_types?.period_days || 365;
          const nextDate = new Date(formData.lastExaminationDate);
          nextDate.setDate(nextDate.getDate() + periodDays);

          const individualUpdates = {
            ...updates,
            next_examination_date: format(nextDate, "yyyy-MM-dd"),
          };

          const { error: updateError } = await supabase
            .from("medical_examinations")
            .update(individualUpdates)
            .eq("id", examinationId);

          if (updateError) throw updateError;
        }
      } else {
        const { error } = await supabase
          .from("medical_examinations")
          .update(updates)
          .in("id", selectedIds);

        if (error) throw error;
      }

      toast({
        title: "Hromadná úprava provedena",
        description: `Úspěšně aktualizováno ${selectedIds.length} prohlídek.`,
      });

      onOpenChange(false);
      setFormData({
        doctor: "",
        medicalFacility: "",
        result: "",
        note: "",
        facility: "",
        lastExaminationDate: undefined,
      });
      onSuccess();
    } catch (error: any) {
      console.error("Error in bulk edit:", error);
      toast({
        title: "Chyba při hromadné úpravě",
        description: error.message || "Nepodařilo se aktualizovat prohlídky.",
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
          <DialogTitle>Hromadná úprava prohlídek</DialogTitle>
          <DialogDescription>
            Změny budou aplikovány na {selectedIds.length} prohlídek.
            Prázdná pole zůstanou beze změny.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Datum poslední prohlídky</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.lastExaminationDate && "text-muted-foreground"
                  )}
                >
                  <CalendarClock className="mr-2 h-4 w-4" />
                  {formData.lastExaminationDate ? (
                    format(formData.lastExaminationDate, "d. MMMM yyyy", { locale: cs })
                  ) : (
                    <span>Vyberte datum (ponechat prázdné pro beze změny)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.lastExaminationDate}
                  onSelect={(date) => setFormData({ ...formData, lastExaminationDate: date })}
                  locale={cs}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-doctor">Lékař</Label>
            <Input
              id="bulk-doctor"
              value={formData.doctor}
              onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
              placeholder="Ponechat prázdné pro beze změny"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-medical-facility">Zdravotnické zařízení</Label>
            <Input
              id="bulk-medical-facility"
              value={formData.medicalFacility}
              onChange={(e) => setFormData({ ...formData, medicalFacility: e.target.value })}
              placeholder="Ponechat prázdné pro beze změny"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-result">Výsledek</Label>
            <Input
              id="bulk-result"
              value={formData.result}
              onChange={(e) => setFormData({ ...formData, result: e.target.value })}
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
