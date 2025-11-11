import { Card } from "@/components/ui/card";

export default function Departments() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-foreground">Střediska</h2>
      
      <Card className="p-6">
        <p className="text-muted-foreground">
          Seznam a správa čísel středisek a jejich názvů.
        </p>
      </Card>
    </div>
  );
}
