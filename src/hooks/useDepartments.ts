import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Department {
  id: string;
  code: string;
  name: string;
}

export interface DepartmentDependencies {
  employeesCount: number;
  equipmentCount: number;
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

  const checkDependencies = async (id: string): Promise<DepartmentDependencies> => {
    const [employeesResult, equipmentResult] = await Promise.all([
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("department_id", id),
      supabase.from("equipment").select("id", { count: "exact", head: true }).eq("department_id", id),
    ]);

    return {
      employeesCount: employeesResult.count || 0,
      equipmentCount: equipmentResult.count || 0,
    };
  };

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
    // First check for dependencies
    const deps = await checkDependencies(id);
    
    if (deps.employeesCount > 0 || deps.equipmentCount > 0) {
      const parts: string[] = [];
      if (deps.employeesCount > 0) {
        parts.push(`${deps.employeesCount} zaměstnanc${deps.employeesCount === 1 ? 'e' : 'ů'}`);
      }
      if (deps.equipmentCount > 0) {
        parts.push(`${deps.equipmentCount} zařízení`);
      }
      throw new Error(`Středisko nelze smazat, protože je přiřazeno k: ${parts.join(' a ')}. Nejprve přesuňte nebo smažte tyto záznamy.`);
    }

    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", id);

    if (error) {
      // Parse FK error for better message
      if (error.message.includes("foreign key constraint")) {
        throw new Error("Středisko nelze smazat, protože je přiřazeno k jiným záznamům. Nejprve přesuňte nebo smažte tyto záznamy.");
      }
      throw error;
    }
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
    checkDependencies,
  };
}