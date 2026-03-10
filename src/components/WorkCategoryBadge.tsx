import { Badge } from "@/components/ui/badge";

interface WorkCategoryBadgeProps {
  category: string | number | null | undefined;
}

const categoryColors: Record<string, string> = {
  "1": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
  "2": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
  "2R": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800",
  "3": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  "4": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800",
};

const categoryLabels: Record<string, string> = {
  "1": "Kategorie 1 - bez rizika",
  "2": "Kategorie 2 - nízké riziko",
  "2R": "Kategorie 2R - riziková (2. kategorie)",
  "3": "Kategorie 3 - riziková",
  "4": "Kategorie 4 - vysoké riziko",
};

export function WorkCategoryBadge({ category }: WorkCategoryBadgeProps) {
  if (!category && category !== 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const key = String(category).toUpperCase();
  const colorClass = categoryColors[key] ?? "bg-muted text-muted-foreground border-border";
  const label = categoryLabels[key] ?? `Kategorie ${key}`;

  return (
    <Badge 
      className={colorClass} 
      title={label}
    >
      {key}
    </Badge>
  );
}
