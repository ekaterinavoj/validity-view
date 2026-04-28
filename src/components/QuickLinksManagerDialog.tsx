import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DashboardQuickLink } from "@/hooks/useUserPreferences";

interface QuickLinksManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: DashboardQuickLink[];
  onSave: (links: DashboardQuickLink[]) => void;
  onResetToDefault: () => void;
}

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `qlink_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export function QuickLinksManagerDialog({
  open,
  onOpenChange,
  links,
  onSave,
  onResetToDefault,
}: QuickLinksManagerDialogProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<DashboardQuickLink[]>(links);

  // Reset draft whenever dialog opens with fresh links
  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(links);
    onOpenChange(next);
  };

  const updateLink = (id: string, patch: Partial<DashboardQuickLink>) => {
    setDraft((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addLink = () => {
    setDraft((prev) => [
      ...prev,
      { id: generateId(), label: "", path: "" },
    ]);
  };

  const removeLink = (id: string) => {
    setDraft((prev) => prev.filter((l) => l.id !== id));
  };

  const move = (index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = () => {
    // Validace – odfiltruj prázdné a hlas chyby
    const cleaned = draft
      .map((l) => ({ ...l, label: l.label.trim(), path: l.path.trim() }))
      .filter((l) => l.label || l.path);

    const invalid = cleaned.find((l) => !l.label || !l.path);
    if (invalid) {
      toast({
        title: "Neúplný odkaz",
        description: "Každý odkaz musí mít vyplněný název i cestu.",
        variant: "destructive",
      });
      return;
    }

    onSave(cleaned);
    onOpenChange(false);
    toast({ title: "Rychlé odkazy uloženy" });
  };

  const handleReset = () => {
    onResetToDefault();
    setDraft([]);
    onOpenChange(false);
    toast({ title: "Obnoveny výchozí odkazy" });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Spravovat rychlé odkazy</DialogTitle>
          <DialogDescription>
            Přizpůsobte si tlačítka v sekci „Rychlé odkazy" na hlavní stránce. Cesta může být interní
            (např. <code className="text-xs">/employees</code>) nebo absolutní URL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {draft.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Žádné vlastní odkazy. Klikněte na „Přidat odkaz" nebo „Obnovit výchozí" pro načtení
              systémových.
            </p>
          ) : (
            draft.map((link, idx) => (
              <div
                key={link.id}
                className="grid grid-cols-[1fr_1.5fr_auto] gap-2 items-end p-3 border border-border rounded-md bg-muted/30"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Název</Label>
                  <Input
                    value={link.label}
                    onChange={(e) => updateLink(link.id, { label: e.target.value })}
                    placeholder="např. Nové školení"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cesta nebo URL</Label>
                  <Input
                    value={link.path}
                    onChange={(e) => updateLink(link.id, { path: e.target.value })}
                    placeholder="/trainings/new"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={idx === 0}
                    onClick={() => move(idx, -1)}
                    title="Posunout nahoru"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={idx === draft.length - 1}
                    onClick={() => move(idx, 1)}
                    title="Posunout dolů"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeLink(link.id)}
                    title="Smazat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}

          <Button type="button" variant="outline" size="sm" onClick={addLink} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1" /> Přidat odkaz
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Obnovit výchozí
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
