import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface ChangeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentEmail: string;
  userName: string;
  onSuccess: () => void;
}

export function ChangeEmailModal({
  open,
  onOpenChange,
  userId,
  currentEmail,
  userName,
  onSuccess,
}: ChangeEmailModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const handleChange = async () => {
    if (!newEmail) {
      toast({
        title: "Vyplňte email",
        description: "Zadejte novou emailovou adresu.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: "Neplatný email",
        description: "Zadejte platnou emailovou adresu.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-change-email", {
        body: {
          userId,
          newEmail,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Email změněn",
        description: `Email byl změněn z ${currentEmail} na ${newEmail}.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Chyba při změně emailu",
        description: error.message,
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
          <DialogTitle>Změnit email</DialogTitle>
          <DialogDescription>
            Změňte emailovou adresu pro uživatele <strong>{userName}</strong>.
            <br />
            Aktuální email: <strong>{currentEmail}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newEmail">Nový email</Label>
            <Input
              id="newEmail"
              type="email"
              placeholder="novy@email.cz"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Zrušit
          </Button>
          <Button onClick={handleChange} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Měním...
              </>
            ) : (
              "Změnit email"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
