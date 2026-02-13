import { Badge } from "@/components/ui/badge";

interface WorkCategoryBadgeProps {
  category: number | null | undefined;
}

const categoryColors: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
  2: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
  3: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  4: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800",
};

const categoryLabels: Record<number, string> = {
  1: "Kategorie 1 - bez rizika",
  2: "Kategorie 2 - nízké riziko",
  3: "Kategorie 3 - střední riziko",
  4: "Kategorie 4 - vysoké riziko",
};

export function WorkCategoryBadge({ category }: WorkCategoryBadgeProps) {
  if (!category) {
    return <span className="text-muted-foreground">-</span>;
  }

  const colorClass = categoryColors[category] ?? "bg-muted text-muted-foreground border-border";
  const label = categoryLabels[category] ?? `Kategorie ${category}`;

  return (
    <Badge 
      className={colorClass} 
      title={label}
    >
      {category}
    </Badge>
  );
}
