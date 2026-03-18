export const HEALTH_RISK_VALUES = ["2", "2R", "3", "4"] as const;

export type HealthRiskValue = (typeof HEALTH_RISK_VALUES)[number];

export interface HealthRisks {
  pracovniPoloha: HealthRiskValue | null;
  celkovaFyzickaZatez: HealthRiskValue | null;
  hluk: HealthRiskValue | null;
  vibracePreneseneNaRuce: HealthRiskValue | null;
  zrakovaZatez: HealthRiskValue | null;
  ultrafialoveZareni: HealthRiskValue | null;
}

export const HEALTH_RISK_FIELDS = [
  {
    key: "pracovniPoloha",
    dbKey: "pracovni_poloha",
    label: "Pracovní poloha",
  },
  {
    key: "celkovaFyzickaZatez",
    dbKey: "celkova_fyzicka_zatez",
    label: "Celková fyzická zátěž",
  },
  {
    key: "hluk",
    dbKey: "hluk",
    label: "Hluk",
  },
  {
    key: "vibracePreneseneNaRuce",
    dbKey: "vibrace_prenesene_na_ruce",
    label: "Vibrace přenášené na ruce",
  },
  {
    key: "zrakovaZatez",
    dbKey: "zrakova_zatez",
    label: "Zraková zátěž",
  },
  {
    key: "ultrafialoveZareni",
    dbKey: "ultrafialove_zareni",
    label: "Ultrafialové záření",
  },
] as const satisfies ReadonlyArray<{
  key: keyof HealthRisks;
  dbKey: string;
  label: string;
}>;

export function createEmptyHealthRisks(): HealthRisks {
  return {
    pracovniPoloha: null,
    celkovaFyzickaZatez: null,
    hluk: null,
    vibracePreneseneNaRuce: null,
    zrakovaZatez: null,
    ultrafialoveZareni: null,
  };
}

function isHealthRiskValue(value: unknown): value is HealthRiskValue {
  return typeof value === "string" && HEALTH_RISK_VALUES.includes(value as HealthRiskValue);
}

export function fromDbHealthRisks(value: unknown): HealthRisks {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    pracovniPoloha: isHealthRiskValue(source.pracovni_poloha) ? source.pracovni_poloha : null,
    celkovaFyzickaZatez: isHealthRiskValue(source.celkova_fyzicka_zatez) ? source.celkova_fyzicka_zatez : null,
    hluk: isHealthRiskValue(source.hluk) ? source.hluk : null,
    vibracePreneseneNaRuce: isHealthRiskValue(source.vibrace_prenesene_na_ruce) ? source.vibrace_prenesene_na_ruce : null,
    zrakovaZatez: isHealthRiskValue(source.zrakova_zatez) ? source.zrakova_zatez : null,
    ultrafialoveZareni: isHealthRiskValue(source.ultrafialove_zareni) ? source.ultrafialove_zareni : null,
  };
}

export function toDbHealthRisks(value: HealthRisks) {
  return {
    pracovni_poloha: value.pracovniPoloha,
    celkova_fyzicka_zatez: value.celkovaFyzickaZatez,
    hluk: value.hluk,
    vibrace_prenesene_na_ruce: value.vibracePreneseneNaRuce,
    zrakova_zatez: value.zrakovaZatez,
    ultrafialove_zareni: value.ultrafialoveZareni,
  };
}

export function getSelectedHealthRiskItems(value: HealthRisks) {
  return HEALTH_RISK_FIELDS.flatMap((field) => {
    const selectedValue = value[field.key];

    return selectedValue
      ? [{ key: field.key, label: field.label, value: selectedValue }]
      : [];
  });
}
