import { BulkImport } from "@/components/BulkImport";

export default function BulkImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Hromadný import školení</h2>
        <p className="text-muted-foreground mt-2">
          Importujte více školení najednou z CSV nebo Excel souboru
        </p>
      </div>

      <BulkImport />
    </div>
  );
}
