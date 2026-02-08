import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, GraduationCap, Wrench, Stethoscope } from "lucide-react";

interface ModuleAccessManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  isAdmin: boolean;
  onSuccess: () => void;
}

const MODULES = [
  { id: "trainings", label: "Školení", icon: GraduationCap },
  { id: "deadlines", label: "Technické lhůty", icon: Wrench },
  { id: "plp", label: "Lékařské prohlídky (PLP)", icon: Stethoscope },
];

export function ModuleAccessManager({
  open,
  onOpenChange,
  userId,
  userName,
  isAdmin,
  onSuccess,
}: ModuleAccessManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moduleAccess, setModuleAccess] = useState<Record<string, boolean>>({
    trainings: false,
    deadlines: false,
    plp: false,
  });

  useEffect(() => {
    if (open && userId) {
      loadModuleAccess();
    }
  }, [open, userId]);

  const loadModuleAccess = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_module_access")
        .select("module")
        .eq("user_id", userId);

      if (error) throw error;

      const access: Record<string, boolean> = {
        trainings: false,
        deadlines: false,
        plp: false,
      };

      data?.forEach((row) => {
        if (row.module in access) {
          access[row.module] = true;
        }
      });

      setModuleAccess(access);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing module access for user
      const { error: deleteError } = await supabase
        .from("user_module_access")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Insert new module access
      const modulesToInsert = Object.entries(moduleAccess)
        .filter(([_, hasAccess]) => hasAccess)
        .map(([module]) => ({
          user_id: userId,
          module,
        }));

      if (modulesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("user_module_access")
          .insert(modulesToInsert);

        if (insertError) throw insertError;
      }

      toast({
        title: "Přístupy uloženy",
        description: `Moduly pro uživatele ${userName} byly aktualizovány.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Chyba při ukládání",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasAnyModule = Object.values(moduleAccess).some(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Správa modulových přístupů</DialogTitle>
          <DialogDescription>
            Nastavte přístupy k modulům pro uživatele <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : isAdmin ? (
          <div className="py-4 px-2 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Administrátor</strong> má automaticky přístup ke všem modulům. Přístupy nelze upravovat.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {MODULES.map(({ id, label, icon: Icon }) => (
              <div key={id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                <Checkbox
                  id={`module-${id}`}
                  checked={moduleAccess[id]}
                  onCheckedChange={(checked) =>
                    setModuleAccess((prev) => ({ ...prev, [id]: !!checked }))
                  }
                />
                <Label htmlFor={`module-${id}`} className="flex items-center gap-2 cursor-pointer flex-1">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {label}
                </Label>
              </div>
            ))}

            {!hasAnyModule && (
              <p className="text-sm text-destructive">
                Uživatel musí mít přístup alespoň k jednomu modulu.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Zrušit
          </Button>
          {!isAdmin && (
            <Button onClick={handleSave} disabled={saving || !hasAnyModule}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ukládám...
                </>
              ) : (
                "Uložit"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
