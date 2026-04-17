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
  {
    value: "lost_long_term",
    label: "Pozbyl(a) dlouhodobě zdravotní způsobilosti",
  },
] as const;

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
  const option = medicalExaminationResultOptions.find((item) => item.value === result);
  return option?.label ?? (result || "-");
}

export function getMedicalExaminationStatusFromResult(result: string | null | undefined, fallbackStatus: "valid" | "warning" | "expired") {
  if (result === "failed" || result === "lost_long_term") {
    return "expired" as const;
  }

  return fallbackStatus;
}
