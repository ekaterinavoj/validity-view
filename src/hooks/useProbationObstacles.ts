import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProbationObstacle {
  id: string;
  employeeId: string;
  dateFrom: string;
  dateTo: string;
  reason: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  days: number;
}

function diffDaysInclusive(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

function map(row: any): ProbationObstacle {
  return {
    id: row.id,
    employeeId: row.employee_id,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    days: diffDaysInclusive(row.date_from, row.date_to),
  };
}

export function useProbationObstacles(employeeId: string | null | undefined) {
  const [obstacles, setObstacles] = useState<ProbationObstacle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!employeeId) {
      setObstacles([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("probation_obstacles" as never)
        .select("*")
        .eq("employee_id", employeeId)
        .order("date_from", { ascending: true });
      if (err) throw err;
      setObstacles((data || []).map(map));
    } catch (e: any) {
      console.error(e);
      setError("Nepodařilo se načíst překážky.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const add = useCallback(
    async (input: { dateFrom: string; dateTo: string; reason: string }) => {
      if (!employeeId) throw new Error("Chybí zaměstnanec");
      const { data: u } = await supabase.auth.getUser();
      const { error: err } = await supabase.from("probation_obstacles" as never).insert({
        employee_id: employeeId,
        date_from: input.dateFrom,
        date_to: input.dateTo,
        reason: input.reason,
        created_by: u?.user?.id ?? null,
      } as never);
      if (err) throw err;
      await fetchAll();
    },
    [employeeId, fetchAll],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: err } = await supabase.from("probation_obstacles" as never).delete().eq("id", id);
      if (err) throw err;
      await fetchAll();
    },
    [fetchAll],
  );

  const totalDays = obstacles.reduce((sum, o) => sum + o.days, 0);

  return { obstacles, loading, error, totalDays, refetch: fetchAll, add, remove };
}
