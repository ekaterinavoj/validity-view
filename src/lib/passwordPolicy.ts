// Client-side mirror of the password policy enforced server-side by GoTrue
// (GOTRUE_PASSWORD_MIN_LENGTH / GOTRUE_PASSWORD_REQUIRED_CHARACTERS in
// docker-compose.supabase.yml — keep these two files in sync). Validating
// here too means the user sees a clear, specific error immediately instead
// of GoTrue's generic rejection after a round-trip.

export const PASSWORD_MIN_LENGTH = 8;

interface RequiredCharacterClass {
  test: RegExp;
  label: string;
}

const REQUIRED_CHARACTER_CLASSES: RequiredCharacterClass[] = [
  { test: /[a-z]/, label: "malé písmeno" },
  { test: /[A-Z]/, label: "velké písmeno" },
  { test: /[0-9]/, label: "číslici" },
];

export const PASSWORD_POLICY_HINT = `Alespoň ${PASSWORD_MIN_LENGTH} znaků, včetně malého písmene, velkého písmene a číslice.`;

/** Returns a list of unmet requirements (empty array = password is valid). */
export function validatePassword(password: string): string[] {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Heslo musí mít alespoň ${PASSWORD_MIN_LENGTH} znaků.`);
  }

  const missingClasses = REQUIRED_CHARACTER_CLASSES.filter((c) => !c.test.test(password)).map((c) => c.label);
  if (missingClasses.length > 0) {
    errors.push(`Heslo musí obsahovat ${missingClasses.join(", ")}.`);
  }

  return errors;
}

export function isPasswordValid(password: string): boolean {
  return validatePassword(password).length === 0;
}
