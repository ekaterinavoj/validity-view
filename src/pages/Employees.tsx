import { Card } from "@/components/ui/card";

export default function Employees() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-foreground">Školené osoby</h2>
      
      <Card className="p-6">
        <p className="text-muted-foreground">
          Správa seznamu zaměstnanců a jejich údajů pro školení.
        </p>
      </Card>
    </div>
  );
}
