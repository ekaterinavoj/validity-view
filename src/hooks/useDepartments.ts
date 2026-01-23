import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Department {
  id: string;
  code: string;
  name: string;
}

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("departments")
        .select("id, code, name")
        .order("code", { ascending: true });

      if (fetchError) throw fetchError;

      setDepartments(data || []);
    } catch (err: any) {
      console.error("Error fetching departments:", err);
      setError("Nepodařilo se načíst střediska. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const createDepartment = async (code: string, name: string) => {
    const { data, error } = await supabase
      .from("departments")
      .insert({ code, name })
      .select()
      .single();

    if (error) throw error;
    await fetchDepartments();
    return data;
  };

  const updateDepartment = async (id: string, code: string, name: string) => {
    const { data, error } = await supabase
      .from("departments")
      .update({ code, name })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    await fetchDepartments();
    return data;
  };

  const deleteDepartment = async (id: string) => {
    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", id);

    if (error) throw error;
    await fetchDepartments();
  };

  return {
    departments,
    loading,
    error,
    refetch: fetchDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
  };
}
