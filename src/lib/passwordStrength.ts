/**
 * Password strength evaluation and validation.
 * Used by ChangePassword, Profile (change own password) and reset modals.
 *
 * Rules (minimum):
 *  - at least 10 characters
 *  - at least one uppercase letter
 *  - at least one digit
 *  - at least one special character (non-alphanumeric)
 */

export type PasswordStrength = "weak" | "medium" | "strong" | "very_strong";

export interface PasswordCheck {
  ok: boolean;
  label: string;
}

export interface PasswordEvaluation {
  score: number; // 0..5
  strength: PasswordStrength;
  percent: number; // 0..100
  checks: {
    length: PasswordCheck;
    upper: PasswordCheck;
    lower: PasswordCheck;
    digit: PasswordCheck;
    special: PasswordCheck;
  };
  /** Hard requirements (the minimum we enforce) — all must be true to allow submit. */
  meetsMinimum: boolean;
  /** Human-readable hint for the first failing requirement, or empty string. */
  firstError: string;
}

const SPECIAL_RE = /[^A-Za-z0-9]/;
const UPPER_RE = /[A-Z]/;
const LOWER_RE = /[a-z]/;
const DIGIT_RE = /\d/;

export const PASSWORD_MIN_LENGTH = 10;

export function evaluatePassword(pw: string): PasswordEvaluation {
  const length = pw.length >= PASSWORD_MIN_LENGTH;
  const upper = UPPER_RE.test(pw);
  const lower = LOWER_RE.test(pw);
  const digit = DIGIT_RE.test(pw);
  const special = SPECIAL_RE.test(pw);

  const checks = {
    length: { ok: length, label: `Alespoň ${PASSWORD_MIN_LENGTH} znaků` },
    upper: { ok: upper, label: "Velké písmeno (A–Z)" },
    lower: { ok: lower, label: "Malé písmeno (a–z)" },
    digit: { ok: digit, label: "Číslice (0–9)" },
    special: { ok: special, label: "Speciální znak (!@#$…)" },
  };

  // Score: 1 point per met rule, +1 bonus for length >= 14
  let score = [length, upper, lower, digit, special].filter(Boolean).length;
  if (pw.length >= 14) score = Math.min(5, score + 1);

  let strength: PasswordStrength = "weak";
  if (score >= 5) strength = "very_strong";
  else if (score === 4) strength = "strong";
  else if (score === 3) strength = "medium";

  const meetsMinimum = length && upper && digit && special;

  let firstError = "";
  if (!length) firstError = `Heslo musí mít alespoň ${PASSWORD_MIN_LENGTH} znaků.`;
  else if (!upper) firstError = "Heslo musí obsahovat alespoň jedno velké písmeno.";
  else if (!digit) firstError = "Heslo musí obsahovat alespoň jednu číslici.";
  else if (!special) firstError = "Heslo musí obsahovat alespoň jeden speciální znak.";

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
