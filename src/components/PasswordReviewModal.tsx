import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordStrength";

const SNOOZE_KEY = "password-review-snoozed-until";
const SNOOZE_DAYS = 7;

/**
 * Modal that nags users with `must_review_password = true` to set a stronger password.
 * Shown after login. User can snooze for 7 days (per browser).
 *
 * Note: Supabase doesn't store password plaintext, so we cannot verify whether the
 * existing password meets the new policy. Instead we ask every legacy user to confirm
 * / rotate to a password that satisfies the current rules.
 */
export const PasswordReviewModal = () => {
  const { profile, user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    const mustReview = (profile as any).must_review_password === true;
    if (!mustReview) {
      setOpen(false);
      return;
    }

    // Per-browser snooze
    try {
      const raw = localStorage.getItem(`${SNOOZE_KEY}:${user.id}`);
      if (raw) {
        const until = new Date(raw).getTime();
        if (!Number.isNaN(until) && until > Date.now()) {
          setOpen(false);
          return;
        }
      }
    } catch {
      // ignore storage errors
    }

    setOpen(true);
  }, [user, profile]);

  const handleSnooze = () => {
    if (!user) return;
    try {
      const until = new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      localStorage.setItem(`${SNOOZE_KEY}:${user.id}`, until);
    } catch {
      // ignore
    }
    setOpen(false);
  };

  const handleDismissForSession = async () => {
    // Track that user has at least seen the message — admin still sees them as pending
    // until the password is actually changed via mark_password_reviewed RPC.
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismissForSession(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-warning" />
            <DialogTitle>Doporučujeme změnit heslo</DialogTitle>
          </div>
          <DialogDescription className="pt-2 space-y-2">
            <span className="block">
              Z důvodu zvýšených bezpečnostních požadavků doporučujeme všem
              stávajícím uživatelům aktualizovat heslo tak, aby splňovalo nová pravidla:
            </span>
            <ul className="list-disc list-inside text-xs text-muted-foreground pl-2">
              <li>Alespoň {PASSWORD_MIN_LENGTH} znaků</li>
              <li>Velké písmeno a číslice</li>
              <li>Speciální znak (např. !@#$)</li>
            </ul>
            <span className="block text-xs text-muted-foreground">
              Vaše stávající heslo zůstává funkční, dokud ho nezměníte.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleSnooze}>
            Připomenout za 7 dní
          </Button>
          <Button asChild onClick={() => setOpen(false)}>
            <Link to="/profile">
              <KeyRound className="w-4 h-4 mr-2" />
              Změnit heslo nyní
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
