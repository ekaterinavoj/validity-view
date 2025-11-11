import { Card } from "@/components/ui/card";

export default function NewTraining() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-foreground">Nové školení</h2>
      
      <Card className="p-6">
        <p className="text-muted-foreground">
          Formulář pro vytvoření nového záznamu školení.
        </p>
      </Card>
    </div>
  );
}
