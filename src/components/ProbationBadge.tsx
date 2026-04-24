import { Badge } from "@/components/ui/badge";
import { formatDisplayDate } from "@/lib/dateFormat";

/**
 * Badge for probation period end date.
 * - Red: ended already or ends today
 * - Amber: ends within 14 days
 * - Green: more than 14 days remaining
 * - Muted: more than 60 days (de-emphasized; just shows date)
 */
export function ProbationBadge({ endDate }: { endDate: string | Date | null | undefined }) {
  if (!endDate) return <span className="text-muted-foreground">-</span>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  end.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((end.getTime() - today.getTime()) / 86400000);

  const formatted = formatDisplayDate(endDate);

  if (daysLeft < 0) {
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/30">
        {formatted} (uplynula)
      </Badge>
    );
  }
  if (daysLeft === 0) {
    return <Badge className="bg-destructive text-destructive-foreground">{formatted} (DNES)</Badge>;
  }
  if (daysLeft <= 14) {
    return <Badge className="bg-warning text-warning-foreground">{formatted} ({daysLeft} dní)</Badge>;
  }
  if (daysLeft <= 60) {
    return <Badge variant="secondary">{formatted} ({daysLeft} dní)</Badge>;
  }
  return <span className="text-sm text-muted-foreground">{formatted}</span>;
}
