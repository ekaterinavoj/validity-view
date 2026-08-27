// NOTE: "lost_long_term" is intentionally NOT exposed in the result picker any more —
// pozbytí dlouhodobé způsobilosti není neplatná prohlídka, jen doplňková poznámka od
// lékaře, která musí zůstat viditelná. Zachycuje se přes samostatný checkbox "Současně
// pozbyl dlouhodobě způsobilosti" (viz EditMedicalExamination / NewMedicalExamination),
// který lze zaškrtnout NEZÁVISLE na hlavním výsledku (typicky spolu s "Zdravotně
// způsobilý"). Hodnota zůstává v union kvůli starým datům, validátorům a importům.
export const medicalExaminationResultOptions = [
  {
    value: "passed",
    label: "Zdravotně způsobilý / způsobilá",
  },
  {
    value: "passed_with_reservations",
    label: "Zdravotně způsobilý / způsobilá s následující podmínkou nebo omezením",
  },
  {
    value: "failed",
    label: "Není zdravotně způsobilý / způsobilá",
  },
] as const;

/** Starší/importovaná hodnota, zachovaná pro zpětnou kompatibilitu, ale skrytá z nového výběru. */
export const LEGACY_LOST_LONG_TERM_OPTION = {
  value: "lost_long_term",
  label: "Pozbyl(a) dlouhodobě zdravotní způsobilosti",
} as const;

export type MedicalExaminationResultValue = (typeof medicalExaminationResultOptions)[number]["value"];

export function isMedicalExaminationResultValue(value: string | null | undefined): value is MedicalExaminationResultValue {
  return medicalExaminationResultOptions.some((option) => option.value === value);
}

export function medicalExaminationResultRequiresNote(result: string | null | undefined): boolean {
  return result === "passed_with_reservations";
}

export function medicalExaminationResultRequiresLossDate(result: string | null | undefined): boolean {
  return result === "lost_long_term";
}

/**
 * True when the user can independently mark "pozbyl dlouhodobě způsobilosti" alongside
 * the main result (i.e. for any result that isn't already the legacy "lost_long_term").
 */
export function medicalExaminationResultAllowsAdditionalLossFlag(result: string | null | undefined): boolean {
  return result !== "lost_long_term";
}

export function getMedicalExaminationResultLabel(result: string | null | undefined): string {
  // Legacy "lost_long_term" records: present as the combination it actually represents.
  if (result === "lost_long_term") {
    return "Zdravotně způsobilý / způsobilá + Pozbyl(a) dlouhodobě zdravotní způsobilosti";
  }
  const option = medicalExaminationResultOptions.find((item) => item.value === result);
  return option?.label ?? (result || "-");
}

export function getMedicalExaminationStatusFromResult(result: string | null | undefined, fallbackStatus: "valid" | "warning" | "expired") {
  if (result === "failed" || result === "lost_long_term") {
    return "expired" as const;
  }

  return fallbackStatus;
}
