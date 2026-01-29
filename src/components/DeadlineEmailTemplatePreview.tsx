import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, Mail, AlertCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface DeadlineEmailTemplatePreviewProps {
  subject: string;
  body: string;
  sampleData?: {
    totalCount: number;
    expiringCount: number;
    expiredCount: number;
  };
}

const VARIABLE_INFO = [
  { var: "{totalCount}", desc: "Celkový počet událostí", color: "bg-blue-100 text-blue-800" },
  { var: "{expiringCount}", desc: "Počet brzy vypršujících", color: "bg-yellow-100 text-yellow-800" },
  { var: "{expiredCount}", desc: "Počet prošlých", color: "bg-red-100 text-red-800" },
  { var: "{reportDate}", desc: "Datum reportu", color: "bg-green-100 text-green-800" },
];

// Sample deadline data for preview
const SAMPLE_DEADLINES = [
  { equipment: "Kompresor K-100", inventoryNumber: "INV-2024-001", deadlineType: "Revize", expires: "25. 1. 2026", days: -2, responsiblePerson: "Jan Novák" },
  { equipment: "Vysokozdvižný vozík", inventoryNumber: "INV-2023-045", deadlineType: "Kalibrace", expires: "28. 1. 2026", days: 5, responsiblePerson: "Marie Svobodová" },
  { equipment: "Tlakový kotel TK-5", inventoryNumber: "INV-2022-103", deadlineType: "Kontrola", expires: "5. 2. 2026", days: 13, responsiblePerson: "-" },
];

export function DeadlineEmailTemplatePreview({ subject, body, sampleData }: DeadlineEmailTemplatePreviewProps) {
  const data = sampleData || {
    totalCount: 12,
    expiringCount: 8,
    expiredCount: 4,
  };

  const today = format(new Date(), "d. M. yyyy", { locale: cs });

  const processedSubject = useMemo(() => {
    return subject
      .replace(/{totalCount}/g, String(data.totalCount))
      .replace(/{expiringCount}/g, String(data.expiringCount))
      .replace(/{expiredCount}/g, String(data.expiredCount))
      .replace(/{reportDate}/g, today);
  }, [subject, data, today]);

  const processedBody = useMemo(() => {
    return body
      .replace(/{totalCount}/g, String(data.totalCount))
      .replace(/{expiringCount}/g, String(data.expiringCount))
      .replace(/{expiredCount}/g, String(data.expiredCount))
      .replace(/{reportDate}/g, today)
      .replace(/\n/g, "<br>");
  }, [body, data, today]);

  // Build sample table HTML for technical deadlines
  const sampleTableHtml = useMemo(() => {
    let html = `
      <table style="border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 14px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Zařízení</th>
            <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Inv. číslo</th>
            <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Typ události</th>
            <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Odpovědná osoba</th>
            <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: left;">Termín</th>
            <th style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">Dnů</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const d of SAMPLE_DEADLINES) {
      const statusColor = d.days < 0 ? "#ef4444" : d.days <= 7 ? "#f59e0b" : "#22c55e";
      html += `
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${d.equipment}</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${d.inventoryNumber}</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${d.deadlineType}</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${d.responsiblePerson}</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${d.expires}</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px; text-align: center;">
            <span style="background-color: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
              ${d.days} dní
            </span>
          </td>
        </tr>
      `;
    }

    html += `
        </tbody>
      </table>
      <p style="margin-top: 10px; font-size: 12px; color: #6b7280;">... a dalších ${data.totalCount - 3} technických událostí</p>
    `;

    return html;
  }, [data.totalCount]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="w-4 h-4" />
          Náhled emailu (živý)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Variable Reference */}
        <div className="flex flex-wrap gap-2">
          {VARIABLE_INFO.map((v) => (
            <Badge key={v.var} variant="outline" className="text-xs">
              <code className="mr-1">{v.var}</code>
              <span className="text-muted-foreground">→</span>
              <span className="ml-1">{v.desc}</span>
            </Badge>
          ))}
        </div>

        <Separator />

        {/* Sample Data Info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="w-4 h-4" />
          <span>Ukázková data: {data.totalCount} událostí ({data.expiredCount} prošlé, {data.expiringCount} brzy vyprší)</span>
        </div>

        {/* Email Preview */}
        <div className="border rounded-lg overflow-hidden">
          {/* Email Header */}
          <div className="bg-muted/50 p-3 border-b">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Předmět:</span>
              <span>{processedSubject || "(prázdný předmět)"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Datum:</span>
              <span>{today}</span>
            </div>
          </div>

          {/* Email Body */}
          <div className="p-4 bg-white">
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: processedBody 
                  ? `${processedBody}<br><br>${sampleTableHtml}` 
                  : "<p class='text-muted-foreground'>(prázdné tělo emailu)</p>" 
              }}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          * Toto je náhled s ukázkovými daty. Skutečný email bude obsahovat aktuální technické události.
        </p>
      </CardContent>
    </Card>
  );
}
