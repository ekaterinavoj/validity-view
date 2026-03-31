import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, Mail, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

type ModuleType = "training" | "deadline" | "medical";

interface IndividualEmailPreviewProps {
  module: ModuleType;
}

const MODULE_CONFIG = {
  training: {
    title: "Náhled individuální připomínky – Školení",
    heading: "Připomínka školení",
    columns: ["Zaměstnanec", "Email", "Školení", "Vyprší", "Dnů"],
    sample: {
      col1: "Jan Novák",
      col2: "jan.novak@example.com",
      col3: "BOZP",
      col4: "", // filled dynamically
      days: 5,
    },
    bodyText: "Dobrý den,\n\nškolení BOZP zaměstnance Jan Novák brzy vyprší.\nZbývá: 5 dnů.",
    footer: "Tento email byl odeslán automaticky systémem evidence školení.",
  },
  deadline: {
    title: "Náhled individuální připomínky – Technické lhůty",
    heading: "Připomínka technické lhůty",
    columns: ["Zařízení", "Inv. číslo", "Typ události", "Vyprší", "Dnů"],
    sample: {
      col1: "Kompresor K-200",
      col2: "INV-00142",
      col3: "Revize tlakové nádoby",
      col4: "",
      days: -3,
    },
    bodyText: "Dobrý den,\n\ntechnická lhůta Revize tlakové nádoby pro zařízení Kompresor K-200 vyžaduje pozornost.\nStav: 3 dny po termínu.",
    footer: "Tento email byl odeslán automaticky systémem evidence technických lhůt.",
  },
  medical: {
    title: "Náhled individuální připomínky – PLP",
    heading: "Připomínka lékařské prohlídky",
    columns: ["Zaměstnanec", "Email", "Typ prohlídky", "Vyprší", "Dnů"],
    sample: {
      col1: "Marie Svobodová",
      col2: "marie.s@example.com",
      col3: "Periodická prohlídka",
      col4: "",
      days: 12,
    },
    bodyText: "Dobrý den,\n\nlékařská prohlídka Periodická prohlídka zaměstnance Marie Svobodová brzy vyprší.\nZbývá: 12 dnů.",
    footer: "Tento email byl odeslán automaticky systémem evidence PLP.",
  },
};

function formatDaysLabel(days: number): string {
  const absDays = Math.abs(days);
  let unit: string;
  if (absDays === 1) unit = "den";
  else if (absDays >= 2 && absDays <= 4) unit = "dny";
  else unit = "dnů";
  return days < 0 ? `${absDays} ${unit} po termínu` : `${days} ${unit}`;
}

export function IndividualEmailPreview({ module }: IndividualEmailPreviewProps) {
  const config = MODULE_CONFIG[module];

  const sampleDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + config.sample.days);
    return format(d, "d. M. yyyy", { locale: cs });
  }, [config.sample.days]);

  const statusColor = config.sample.days < 0
    ? "#ef4444"
    : config.sample.days <= 7
      ? "#f59e0b"
      : "#22c55e";

  const daysLabel = formatDaysLabel(config.sample.days);

  const tableHtml = useMemo(() => {
    const cols = config.columns;
    const s = config.sample;
    const headerCells = cols.map(
      (c, i) =>
        `<th style="border: 1px solid #e5e7eb; padding: 10px; text-align: ${i === cols.length - 1 ? "center" : "left"};">${c}</th>`
    ).join("");
    const values = [s.col1, s.col2, s.col3, sampleDate];
    const dataCells = values.map(
      (v) => `<td style="border: 1px solid #e5e7eb; padding: 10px;">${v}</td>`
    ).join("");
    const dayCell = `<td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">
      <span style="background-color: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${daysLabel}</span>
    </td>`;
    return `
      <table style="border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 14px;">
        <thead><tr style="background-color: #f3f4f6;">${headerCells}</tr></thead>
        <tbody><tr>${dataCells}${dayCell}</tr></tbody>
      </table>
    `;
  }, [config, sampleDate, statusColor, daysLabel]);

  const bodyHtml = config.bodyText.replace(/\n/g, "<br>");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="w-4 h-4" />
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">Per-záznam</Badge>
          <span>Tento email se posílá individuálně pro každý záznam blížící se expiraci</span>
        </div>

        <Separator />

        <div className="border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-muted/50 p-3 border-b">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Předmět:</span>
              <span>{config.heading}: {config.sample.col1} - {config.sample.col3}</span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Datum:</span>
              <span>{format(new Date(), "d. M. yyyy", { locale: cs })}</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 bg-white">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: `
                  <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                      ${bodyHtml}
                    </div>
                    ${tableHtml}
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="color: #9ca3af; font-size: 12px;">${config.footer}</p>
                  </div>
                `,
              }}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          * Obsah emailu se řídí šablonou přiřazenou k záznamu (šablony spravujte v záložce Šablony).
        </p>
      </CardContent>
    </Card>
  );
}
