import { Card } from "@/components/ui/card";

export default function History() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-foreground">Historie školení</h2>
      
      <Card className="p-6">
        <p className="text-muted-foreground">
          Přehled historie všech změn, storno a zpětných oprav s časovou značkou a uživatelem.
        </p>
      </Card>
    </div>
  );
}
