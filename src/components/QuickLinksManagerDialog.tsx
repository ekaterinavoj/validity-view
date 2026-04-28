import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardQuickLink } from "@/hooks/useUserPreferences";

interface QuickLinksManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: DashboardQuickLink[];
  onSave: (links: DashboardQuickLink[]) => void;
  onResetToDefault: () => void;
}

interface CatalogItem {
  id: string; // stabilní ID = klíč v preferencích
  label: string;
  path: string;
  module?: "trainings" | "deadlines" | "plp" | null; // null = dostupné všem schváleným
  adminOnly?: boolean;
}

// Centrální katalog možných rychlých odkazů. Stabilní ID umožňují uložit jen výběr.
const CATALOG: CatalogItem[] = [
  { id: "new-training", label: "+ Nové školení", path: "/trainings/new", module: "trainings" },
  { id: "new-deadline", label: "+ Nová tech. událost", path: "/deadlines/new", module: "deadlines" },
  { id: "new-plp", label: "+ Nová PLP", path: "/plp/new", module: "plp", adminOnly: true },
  { id: "trainings-list", label: "Přehled školení", path: "/trainings", module: "trainings" },
  { id: "deadlines-list", label: "Přehled tech. událostí", path: "/deadlines", module: "deadlines" },
  { id: "plp-list", label: "Přehled PLP", path: "/plp", module: "plp" },
  { id: "employees", label: "Zaměstnanci", path: "/employees" },
  { id: "probations", label: "Zkušební doby", path: "/probations" },
  { id: "equipment", label: "Vybavení", path: "/equipment" },
  { id: "documents", label: "Dokumenty", path: "/documents" },
  { id: "guides", label: "Návody", path: "/guides" },
  { id: "permissions", label: "Moje oprávnění", path: "/profile?tab=permissions" },
  { id: "statistics", label: "Statistiky", path: "/statistics", adminOnly: true },
];

export function QuickLinksManagerDialog({
  open,
  onOpenChange,
  links,
  onSave,
  onResetToDefault,
}: QuickLinksManagerDialogProps) {
  const { toast } = useToast();
  const { hasModuleAccess, isAdmin } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filtruj katalog podle oprávnění uživatele.
  const availableItems = useMemo(
    () =>
      CATALOG.filter((item) => {
        if (item.adminOnly && !isAdmin) return false;
        if (item.module && !hasModuleAccess(item.module)) return false;
        return true;
      }),
    [hasModuleAccess, isAdmin],
  );

  // Při otevření hydratuj výběr z aktuálních uložených odkazů (matchuj podle id NEBO path).
  useEffect(() => {
    if (!open) return;
    const set = new Set<string>();
    for (const link of links) {
      const matched = CATALOG.find((c) => c.id === link.id || c.path === link.path);
      if (matched) set.add(matched.id);
    }
    setSelected(set);
  }, [open, links]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    // Uložíme v pořadí dle katalogu (předvídatelné pořadí na dashboardu).
    const result: DashboardQuickLink[] = availableItems
      .filter((item) => selected.has(item.id))
      .map((item) => ({ id: item.id, label: item.label, path: item.path }));
    onSave(result);
    onOpenChange(false);
    toast({ title: "Rychlé odkazy uloženy" });
  };

  const handleReset = () => {
    onResetToDefault();
    setSelected(new Set());
    onOpenChange(false);
    toast({ title: "Obnoveny výchozí odkazy" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rychlé odkazy</DialogTitle>
          <DialogDescription>
            Zaškrtněte odkazy, které se mají zobrazit na hlavní stránce.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 py-2">
          {availableItems.map((item) => {
            const checked = selected.has(item.id);
            return (
              <label
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(item.id)} />
                <span className="text-sm">{item.label}</span>
              </label>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Výchozí
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button type="button" onClick={handleSave}>
            Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
