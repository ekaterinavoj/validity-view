// NOTE: "lost_long_term" is intentionally NOT exposed in the result picker any more —
// it is captured via the standalone "Současně pozbyl dlouhodobě způsobilosti" checkbox
// (see EditMedicalExamination / NewMedicalExamination). The value is kept in the union
// for legacy data, validators and importers.
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

/** Legacy/imported value, kept for backwards compatibility but hidden from the new UI picker. */
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
 * Returns true if the user can independently mark "lost long-term fitness" alongside the main result
 * (i.e. for any positive result that isn't already "lost_long_term").
 */
export function medicalExaminationResultAllowsAdditionalLossFlag(result: string | null | undefined): boolean {
  return result !== "lost_long_term";
}

export function getMedicalExaminationResultLabel(result: string | null | undefined): string {
  // Legacy "lost_long_term" is presented as "way to combine" — fitness preserved + long-term loss flag.
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
