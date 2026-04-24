/**
 * Password strength evaluation and validation.
 * Used by ChangePassword, Profile (change own password) and reset modals.
 *
 * Rules are CONFIGURABLE via system_settings.password_policy. Defaults below
 * are used as fallback when the policy hasn't loaded yet.
 */

export type PasswordStrength = "weak" | "medium" | "strong" | "very_strong";

export interface PasswordCheck {
  ok: boolean;
  label: string;
}

export interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_digit: boolean;
  require_special: boolean;
  /** Force password change after N days. */
  max_age_enabled: boolean;
  max_age_days: number;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  min_length: 10,
  require_uppercase: true,
  require_lowercase: false,
  require_digit: true,
  require_special: true,
  max_age_enabled: false,
  max_age_days: 90,
};

/** @deprecated kept for backward compat with PasswordReviewModal — falls back to default policy */
export const PASSWORD_MIN_LENGTH = DEFAULT_PASSWORD_POLICY.min_length;

export interface PasswordEvaluation {
  score: number; // 0..5
  strength: PasswordStrength;
  percent: number; // 0..100
  checks: Record<string, PasswordCheck>;
  /** Hard requirements (the minimum we enforce) — all must be true to allow submit. */
  meetsMinimum: boolean;
  /** Human-readable hint for the first failing requirement, or empty string. */
  firstError: string;
}

const SPECIAL_RE = /[^A-Za-z0-9]/;
const UPPER_RE = /[A-Z]/;
const LOWER_RE = /[a-z]/;
const DIGIT_RE = /\d/;

export function evaluatePassword(
  pw: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): PasswordEvaluation {
  const lengthOk = pw.length >= policy.min_length;
  const upperOk = UPPER_RE.test(pw);
  const lowerOk = LOWER_RE.test(pw);
  const digitOk = DIGIT_RE.test(pw);
  const specialOk = SPECIAL_RE.test(pw);

  // Build dynamic checks object — only include rules that are required by the policy
  const checks: Record<string, PasswordCheck> = {
    length: { ok: lengthOk, label: `Alespoň ${policy.min_length} znaků` },
  };
  if (policy.require_uppercase) checks.upper = { ok: upperOk, label: "Velké písmeno (A–Z)" };
  if (policy.require_lowercase) checks.lower = { ok: lowerOk, label: "Malé písmeno (a–z)" };
  if (policy.require_digit) checks.digit = { ok: digitOk, label: "Číslice (0–9)" };
  if (policy.require_special) checks.special = { ok: specialOk, label: "Speciální znak (!@#$…)" };

  // Score: 1 point per met rule (out of all 5 standard rules), +1 bonus for length >= 14
  let score = [lengthOk, upperOk, lowerOk, digitOk, specialOk].filter(Boolean).length;
  if (pw.length >= 14) score = Math.min(5, score + 1);

  let strength: PasswordStrength = "weak";
  if (score >= 5) strength = "very_strong";
  else if (score === 4) strength = "strong";
  else if (score === 3) strength = "medium";

  const meetsMinimum =
    lengthOk &&
    (!policy.require_uppercase || upperOk) &&
    (!policy.require_lowercase || lowerOk) &&
    (!policy.require_digit || digitOk) &&
    (!policy.require_special || specialOk);

  let firstError = "";
  if (!lengthOk) firstError = `Heslo musí mít alespoň ${policy.min_length} znaků.`;
  else if (policy.require_uppercase && !upperOk) firstError = "Heslo musí obsahovat alespoň jedno velké písmeno.";
  else if (policy.require_lowercase && !lowerOk) firstError = "Heslo musí obsahovat alespoň jedno malé písmeno.";
  else if (policy.require_digit && !digitOk) firstError = "Heslo musí obsahovat alespoň jednu číslici.";
  else if (policy.require_special && !specialOk) firstError = "Heslo musí obsahovat alespoň jeden speciální znak.";

  return {
    score,
    strength,
    percent: Math.round((score / 5) * 100),
    checks,
    meetsMinimum,
    firstError,
  };
}

export function strengthLabel(s: PasswordStrength): string {
  switch (s) {
    case "very_strong":
      return "Velmi silné";
    case "strong":
      return "Silné";
    case "medium":
      return "Střední";
    default:
      return "Slabé";
  }
}

/** Tailwind classes for the strength meter bar (semantic tokens only). */
export function strengthBarClass(s: PasswordStrength): string {
  switch (s) {
    case "very_strong":
    case "strong":
      return "bg-[hsl(var(--status-valid))]";
    case "medium":
      return "bg-warning";
    default:
      return "bg-destructive";
  }
}

/**
 * Returns true if password is older than `max_age_days` (only when policy.max_age_enabled).
 * `passwordUpdatedAt` may be null (never recorded) — in that case we treat it as expired
 * if the policy is enabled, so users go through the review flow.
 */
export function isPasswordExpired(
  passwordUpdatedAt: string | null | undefined,
  policy: PasswordPolicy
): boolean {
  if (!policy.max_age_enabled) return false;
  if (!passwordUpdatedAt) return true;
  const updated = new Date(passwordUpdatedAt).getTime();
  if (Number.isNaN(updated)) return true;
  const ageMs = Date.now() - updated;
  return ageMs > policy.max_age_days * 24 * 60 * 60 * 1000;
}
