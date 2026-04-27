import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, KeyRound, BellOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePasswordPolicy } from "@/hooks/usePasswordPolicy";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { isPasswordExpired } from "@/lib/passwordStrength";
import { useToast } from "@/hooks/use-toast";

const SNOOZE_KEY = "password-review-snoozed-until";
const SNOOZE_DAYS = 7;

/**
 * Modal that nags users to set a stronger password. Shown after login when EITHER:
 *   - profile.must_review_password === true (legacy flag — admin or migration set it), OR
 *   - the active password_policy has max_age_enabled and the user's
 *     password_updated_at is older than max_age_days.
 *
 * User can:
 *   - "Připomenout za 7 dní" — per-browser snooze (localStorage, useful when user
 *     plans to change soon),
 *   - "Už mi to nepřipomínat" — uloží trvalý opt-out do user_preferences
 *     (synchronizováno přes zařízení), platí pouze pro doporučení (rotace);
 *     u must_change_password / must_review_password od admina opt-out NEMÁ vliv,
 *     protože admin chce explicitně, aby uživatel heslo změnil.
 */
export const PasswordReviewModal = () => {
  const { profile, user } = useAuth();
  const { policy } = usePasswordPolicy();
  const { preferences, updatePreference } = useUserPreferences();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const passwordExpired = useMemo(() => {
    if (!profile) return false;
    return isPasswordExpired((profile as any).password_updated_at ?? null, policy);
  }, [profile, policy]);

  // mustReview = explicit admin/migration flag → cannot be silenced via opt-out
  const mustReview = (profile as any)?.must_review_password === true;

  useEffect(() => {
    if (!user || !profile) return;
    if (!mustReview && !passwordExpired) {
      setOpen(false);
      return;
    }

    // Trvalý opt-out (jen pro "doporučení" — když není mustReview)
    if (!mustReview && preferences.passwordReviewSnoozedForever) {
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
  }, [user, profile, passwordExpired, mustReview, preferences.passwordReviewSnoozedForever]);

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

  const handleNeverRemind = () => {
    updatePreference("passwordReviewSnoozedForever", true);
    toast({
      title: "Připomínka vypnuta",
      description: "Připomínání rotace hesla bylo trvale vypnuto. Změnit zpět můžete v Profilu (Nastavení → Bezpečnost).",
    });
    setOpen(false);
  };

  const handleDismissForSession = () => {
    setOpen(false);
  };

  // Dynamically build requirement bullets from active policy
  const ruleBullets: string[] = [`Alespoň ${policy.min_length} znaků`];
  if (policy.require_uppercase && policy.require_digit) {
    ruleBullets.push("Velké písmeno a číslice");
  } else {
    if (policy.require_uppercase) ruleBullets.push("Velké písmeno");
    if (policy.require_digit) ruleBullets.push("Číslice");
  }
  if (policy.require_lowercase) ruleBullets.push("Malé písmeno");
  if (policy.require_special) ruleBullets.push("Speciální znak (např. !@#$)");

  const headline = passwordExpired
    ? "Vaše heslo vypršelo"
    : "Doporučujeme změnit heslo";
  const intro = passwordExpired
    ? `Z bezpečnostních důvodů je vhodné měnit heslo nejméně každých ${policy.max_age_days} dní. Nastavte si nové heslo splňující aktuální pravidla:`
    : "Z důvodu zvýšených bezpečnostních požadavků doporučujeme všem stávajícím uživatelům aktualizovat heslo tak, aby splňovalo nová pravidla:";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismissForSession(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-warning" />
            <DialogTitle>{headline}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 space-y-2">
            <span className="block">{intro}</span>
            <ul className="list-disc list-inside text-xs text-muted-foreground pl-2">
              {ruleBullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <span className="block text-xs text-muted-foreground">
              Vaše stávající heslo zůstává funkční, dokud ho nezměníte.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          {!mustReview && (
            <Button variant="ghost" size="sm" onClick={handleNeverRemind} title="Trvale vypnout připomínání rotace hesla">
              <BellOff className="w-4 h-4 mr-2" />
              Už mi to nepřipomínat
            </Button>
          )}
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
