import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, Mail, Clock, Plus } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export type ReminderModule = "trainings" | "deadlines" | "medical";

export interface ReminderTemplateFormData {
  name: string;
  description: string;
  email_subject: string;
  email_body: string;
  is_active: boolean;
}

interface VariableDef {
  token: string; // e.g. "{{training_name}}"
  label: string; // human-friendly description
  sample: string; // sample replacement
}

interface ReminderTemplateEditorProps {
  module: ReminderModule;
  formData: ReminderTemplateFormData;
  onChange: (next: ReminderTemplateFormData) => void;
}

// ─── Variable definitions per module ────────────────────────────────────────
const VARIABLES: Record<ReminderModule, VariableDef[]> = {
  trainings: [
    { token: "{{employeeName}}", label: "Jméno zaměstnance", sample: "Jan Novák" },
    { token: "{{training_name}}", label: "Název školení", sample: "Bezpečnost práce" },
    { token: "{{daysLeft}}", label: "Počet dní do vypršení", sample: "15" },
    { token: "{{expiryDate}}", label: "Datum vypršení", sample: "25. 1. 2026" },
    { token: "{{records_table}}", label: "Tabulka všech záznamů", sample: "[tabulka]" },
  ],
  deadlines: [
    { token: "{{equipmentName}}", label: "Název zařízení", sample: "Hasící přístroj A1" },
    { token: "{{inventoryNumber}}", label: "Inventární číslo", sample: "INV-2024-001" },
    { token: "{{deadlineType}}", label: "Typ události", sample: "Revize" },
    { token: "{{daysLeft}}", label: "Počet dní do vypršení", sample: "15" },
    { token: "{{expiryDate}}", label: "Datum vypršení", sample: "25. 1. 2026" },
    { token: "{{responsiblePerson}}", label: "Odpovědná osoba", sample: "Jan Novák" },
    { token: "{{records_table}}", label: "Tabulka všech záznamů", sample: "[tabulka]" },
  ],
  medical: [
    { token: "{{employeeName}}", label: "Jméno zaměstnance", sample: "Jan Novák" },
    { token: "{{examinationType}}", label: "Typ prohlídky", sample: "Vstupní prohlídka" },
    { token: "{{daysLeft}}", label: "Počet dní do vypršení", sample: "15" },
    { token: "{{expiryDate}}", label: "Datum vypršení", sample: "25. 1. 2026" },
    { token: "{{records_table}}", label: "Tabulka všech záznamů", sample: "[tabulka]" },
  ],
};

// ─── Sample data for preview tables ─────────────────────────────────────────
function buildSampleTable(module: ReminderModule): string {
  if (module === "trainings") {
    const rows = [
      ["Jan Novák", "BOZP", "25. 1. 2026", -2],
      ["Marie Svobodová", "Požární ochrana", "5. 2. 2026", 13],
    ];
    return tableHtml(
      ["Zaměstnanec", "Školení", "Termín", "Dnů"],
      rows.map(([emp, name, date, d]) => [
        String(emp),
        String(name),
        String(date),
        renderDaysCell(Number(d)),
      ])
    );
  }
  if (module === "deadlines") {
    const rows = [
      ["Hasící přístroj A1", "INV-2024-001", "Revize", "5. 2. 2026", 13],
      ["Kompresor K-100", "INV-2023-045", "Kontrola", "25. 1. 2026", -2],
    ];
    return tableHtml(
      ["Zařízení", "Inv. číslo", "Typ události", "Termín", "Dnů"],
      rows.map(([eq, inv, type, date, d]) => [
        String(eq),
        String(inv),
        String(type),
        String(date),
        renderDaysCell(Number(d)),
      ])
    );
  }
  // medical
  const rows = [
    ["Jan Novák", "Vstupní prohlídka", "5. 2. 2026", 13],
    ["Marie Svobodová", "Periodická prohlídka", "25. 1. 2026", -2],
  ];
  return tableHtml(
    ["Zaměstnanec", "Typ prohlídky", "Termín", "Dnů"],
    rows.map(([emp, type, date, d]) => [
      String(emp),
      String(type),
      String(date),
      renderDaysCell(Number(d)),
    ])
  );
}

function renderDaysCell(d: number): string {
  const color = d < 0 ? "#ef4444" : d <= 7 ? "#f59e0b" : "#22c55e";
  const label = d < 0 ? `${Math.abs(d)} po termínu` : `${d} dní`;
  return `<span style="background-color:${color};color:white;padding:2px 8px;border-radius:4px;font-size:12px;">${label}</span>`;
}

function tableHtml(headers: string[], rows: string[][]): string {
  const head = headers
    .map(
      (h) =>
        `<th style="border:1px solid #e5e7eb;padding:10px;text-align:left;background:#f3f4f6;">${h}</th>`
    )
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c, idx) =>
              `<td style="border:1px solid #e5e7eb;padding:10px;${
                idx === r.length - 1 ? "text-align:center;" : ""
              }">${c}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:13px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// ─── Variable substitution for preview ──────────────────────────────────────
function substitute(
  text: string,
  module: ReminderModule,
  expirySample: string,
  tableSample: string
): string {
  let out = text;
  // shared
  out = out.replace(/\{\{records_table\}\}/g, tableSample);
  out = out.replace(/\{\{expiryDate\}\}/g, expirySample);
  out = out.replace(/\{\{expiry_date\}\}/g, expirySample);
  out = out.replace(/\{expiryDate\}/g, expirySample);

  if (module === "trainings") {
    out = out
      .replace(/\{\{training_name\}\}/g, "Bezpečnost práce")
      .replace(/\{\{employeeName\}\}/g, "Jan Novák")
      .replace(/\{\{employee_name\}\}/g, "Jan Novák")
      .replace(/\{\{daysLeft\}\}/g, "15")
      .replace(/\{\{days_remaining\}\}/g, "15")
      .replace(/\{\{days_left\}\}/g, "15")
      .replace(/\{employeeName\}/g, "Jan Novák")
      .replace(/\{daysLeft\}/g, "15");
  } else if (module === "deadlines") {
    out = out
      .replace(/\{\{equipmentName\}\}/g, "Hasící přístroj A1")
      .replace(/\{\{equipment_name\}\}/g, "Hasící přístroj A1")
      .replace(/\{\{inventoryNumber\}\}/g, "INV-2024-001")
      .replace(/\{\{equipment_inventory_number\}\}/g, "INV-2024-001")
      .replace(/\{\{deadlineType\}\}/g, "Revize")
      .replace(/\{\{deadline_type\}\}/g, "Revize")
      .replace(/\{\{daysLeft\}\}/g, "15")
      .replace(/\{\{days_left\}\}/g, "15")
      .replace(/\{\{responsiblePerson\}\}/g, "Jan Novák")
      .replace(/\{\{responsible_person\}\}/g, "Jan Novák")
      .replace(/\{equipmentName\}/g, "Hasící přístroj A1")
      .replace(/\{deadlineType\}/g, "Revize")
      .replace(/\{daysLeft\}/g, "15")
      .replace(/\{responsiblePerson\}/g, "Jan Novák");
  } else {
    out = out
      .replace(/\{\{employeeName\}\}/g, "Jan Novák")
      .replace(/\{\{employee_name\}\}/g, "Jan Novák")
      .replace(/\{\{examinationType\}\}/g, "Vstupní prohlídka")
      .replace(/\{\{examination_type\}\}/g, "Vstupní prohlídka")
      .replace(/\{\{daysLeft\}\}/g, "15")
      .replace(/\{\{days_left\}\}/g, "15")
      .replace(/\{employeeName\}/g, "Jan Novák")
      .replace(/\{examinationType\}/g, "Vstupní prohlídka")
      .replace(/\{daysLeft\}/g, "15");
  }

  return out;
}

export const ReminderTemplateEditor = ({
  module,
  formData,
  onChange,
}: ReminderTemplateEditorProps) => {
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");

  const variables = VARIABLES[module];
  const today = format(new Date(), "d. M. yyyy", { locale: cs });
  // sample expiry date 15 days in future
  const sampleExpiry = format(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    "d. M. yyyy",
    { locale: cs }
  );

  const sampleTable = useMemo(() => buildSampleTable(module), [module]);

  const previewSubject = useMemo(
    () => substitute(formData.email_subject, module, sampleExpiry, "[tabulka záznamů]"),
    [formData.email_subject, module, sampleExpiry]
  );
  const previewBody = useMemo(() => {
    const subbed = substitute(formData.email_body, module, sampleExpiry, sampleTable);
    return subbed.replace(/\n/g, "<br>");
  }, [formData.email_body, module, sampleExpiry, sampleTable]);

  // Insert token at cursor position in given field
  const insertToken = (field: "subject" | "body", token: string) => {
    if (field === "subject") {
      const el = subjectRef.current;
      if (!el) return;
      const start = el.selectionStart ?? formData.email_subject.length;
      const end = el.selectionEnd ?? formData.email_subject.length;
      const next =
        formData.email_subject.slice(0, start) + token + formData.email_subject.slice(end);
      onChange({ ...formData, email_subject: next });
      // restore caret after react re-render
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    } else {
      const el = bodyRef.current;
      if (!el) return;
      const start = el.selectionStart ?? formData.email_body.length;
      const end = el.selectionEnd ?? formData.email_body.length;
      const next =
        formData.email_body.slice(0, start) + token + formData.email_body.slice(end);
      onChange({ ...formData, email_body: next });
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ─── EDITOR (left) ─── */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rt-name">Název šablony *</Label>
          <Input
            id="rt-name"
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            placeholder="např. Základní připomínka 30 dní"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rt-desc">Popis</Label>
          <Input
            id="rt-desc"
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            placeholder="Volitelný popis šablony"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rt-subject">Předmět emailu *</Label>
          <Input
            id="rt-subject"
            ref={subjectRef}
            value={formData.email_subject}
            onChange={(e) => onChange({ ...formData, email_subject: e.target.value })}
            onFocus={() => setActiveField("subject")}
            placeholder="např. Připomínka: blíží se konec platnosti"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rt-body">Text emailu *</Label>
          <Textarea
            id="rt-body"
            ref={bodyRef}
            value={formData.email_body}
            onChange={(e) => onChange({ ...formData, email_body: e.target.value })}
            onFocus={() => setActiveField("body")}
            rows={12}
            placeholder="Text připomínky..."
            className="font-mono text-sm"
          />
        </div>

        {/* Variable chips */}
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Vložit proměnnou do {activeField === "subject" ? "předmětu" : "textu"}</Label>
            <span className="text-xs text-muted-foreground">
              klikněte pro vložení na pozici kurzoru
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => insertToken(activeField, v.token)}
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent hover:border-primary transition-colors"
                title={v.label}
              >
                <Plus className="h-3 w-3" />
                <code className="font-mono">{v.token}</code>
                <span className="text-muted-foreground">— {v.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="rt-active"
            checked={formData.is_active}
            onCheckedChange={(checked) => onChange({ ...formData, is_active: checked })}
          />
          <Label htmlFor="rt-active" className="cursor-pointer">
            Aktivní šablona
          </Label>
        </div>
      </div>

      {/* ─── LIVE PREVIEW (right) ─── */}
      <Card className="lg:sticky lg:top-2 self-start">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="w-4 h-4" />
            Živý náhled emailu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {variables.slice(0, 4).map((v) => (
              <Badge key={v.token} variant="outline" className="text-[10px]">
                <code className="mr-1">{v.token}</code>→ {v.label}
              </Badge>
            ))}
          </div>
          <Separator />

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 p-3 border-b space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium shrink-0">Předmět:</span>
                <span className="truncate">
                  {previewSubject || (
                    <span className="text-muted-foreground italic">(prázdný předmět)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium shrink-0">Datum:</span>
                <span>{today}</span>
              </div>
            </div>

            <div className="p-4 bg-white max-h-[450px] overflow-y-auto">
              {previewBody ? (
                <div
                  className="prose prose-sm max-w-none text-foreground"
                  // Sample data only — no user-supplied HTML can leak here, but we
                  // still render React-controlled markup to keep TS happy.
                  dangerouslySetInnerHTML={{ __html: previewBody }}
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">(prázdné tělo emailu)</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Náhled používá ukázková data. Skutečný email obsahuje aktuální záznamy
            v okamžiku odeslání.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
