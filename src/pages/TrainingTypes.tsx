import { Card } from "@/components/ui/card";

export default function TrainingTypes() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-foreground">Typy školení</h2>
      
      <Card className="p-6">
        <p className="text-muted-foreground">
          Správa typů školení podle provozoven s možností editace periodicity.
        </p>
      </Card>
    </div>
  );
}
