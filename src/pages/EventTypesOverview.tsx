import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GraduationCap, Wrench, Stethoscope, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeriodicityDual } from "@/components/TypePeriodicityCell";
import { useFacilities } from "@/hooks/useFacilities";

interface TypeRow {
  id: string;
  name: string;
  facility: string;
  period_days: number;
  description: string | null;
}

const fetchTrainingTypes = async (): Promise<TypeRow[]> => {
  const { data, error } = await supabase
    .from("training_types")
    .select("id, name, facility, period_days, description")
    .order("name");
  if (error) throw error;
  return data || [];
};

const fetchDeadlineTypes = async (): Promise<TypeRow[]> => {
  const { data, error } = await supabase
    .from("deadline_types")
    .select("id, name, facility, period_days, description")
    .order("name");
  if (error) throw error;
  return data || [];
};

const fetchMedicalTypes = async (): Promise<TypeRow[]> => {
  const { data, error } = await supabase
    .from("medical_examination_types")
    .select("id, name, facility, period_days, description")
    .order("name");
  if (error) throw error;
  return data || [];
};

const formatPeriod = (days: number) => formatPeriodicityDual(days);

const TypeSection = ({
  title,
  icon: Icon,
  types,
  loading,
  searchQuery,
  colorClass,
  facilityNameMap,
}: {
  title: string;
  icon: React.ElementType;
  types: TypeRow[];
  loading: boolean;
  searchQuery: string;
  colorClass: string;
  facilityNameMap: Record<string, string>;
}) => {
  const getFacilityName = (code: string) => facilityNameMap[code] || code;
  const filtered = useMemo(() => {
    if (!searchQuery) return types;
    const q = searchQuery.toLowerCase();
    return types.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        getFacilityName(t.facility).toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
    );
  }, [types, searchQuery, facilityNameMap]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className={`w-5 h-5 ${colorClass}`} />
          {title}
          <span className="text-sm font-normal text-muted-foreground">
            ({filtered.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {searchQuery ? "Žádné výsledky" : "Žádné typy"}
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">Název</th>
                  <th className="text-left px-3 py-2 font-medium">Provozovna</th>
                  <th className="text-left px-3 py-2 font-medium">Periodicita</th>
                  <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Popis</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{t.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{getFacilityName(t.facility)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatPeriod(t.period_days)}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden md:table-cell truncate max-w-[300px]">
                      {t.description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const EventTypesOverview = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { facilities: facilitiesData } = useFacilities();

  const facilityNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    facilitiesData.forEach(f => { map[f.code] = f.name; });
    return map;
  }, [facilitiesData]);

  const { data: trainingTypes = [], isLoading: loadingTraining } = useQuery({
    queryKey: ["training-types-overview"],
    queryFn: fetchTrainingTypes,
  });

  const { data: deadlineTypes = [], isLoading: loadingDeadline } = useQuery({
    queryKey: ["deadline-types-overview"],
    queryFn: fetchDeadlineTypes,
  });

  const { data: medicalTypes = [], isLoading: loadingMedical } = useQuery({
    queryKey: ["medical-types-overview"],
    queryFn: fetchMedicalTypes,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Přehled typů událostí</h1>
          <p className="text-muted-foreground text-sm">
            Souhrnný přehled všech typů událostí napříč moduly (pouze pro čtení)
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hledat typ události..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <TypeSection
        title="Typy školení"
        icon={GraduationCap}
        types={trainingTypes}
        loading={loadingTraining}
        searchQuery={searchQuery}
        colorClass="text-blue-500"
        facilityNameMap={facilityNameMap}
      />

      <TypeSection
        title="Typy technických událostí"
        icon={Wrench}
        types={deadlineTypes}
        loading={loadingDeadline}
        searchQuery={searchQuery}
        colorClass="text-orange-500"
        facilityNameMap={facilityNameMap}
      />

      <TypeSection
        title="Typy lékařských prohlídek"
        icon={Stethoscope}
        types={medicalTypes}
        loading={loadingMedical}
        searchQuery={searchQuery}
        colorClass="text-green-500"
        facilityNameMap={facilityNameMap}
      />
    </div>
  );
};

export default EventTypesOverview;
