import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmployeeWithDepartment {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  department: string;
  departmentId: string | null;
  status: "employed" | "parental_leave" | "sick_leave" | "terminated";
  terminationDate?: string;
  notes?: string;
}

export function useEmployees(statusFilter?: string) {
  const [employees, setEmployees] = useState<EmployeeWithDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("employees")
        .select(`
          id,
          employee_number,
          first_name,
          last_name,
          email,
          position,
          status,
          termination_date,
          notes,
          department_id,
          departments (
            id,
            code,
            name
          )
        `)
        .order("last_name", { ascending: true });

      // Apply status filter if provided
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const transformedData: EmployeeWithDepartment[] = (data || []).map((e: any) => ({
        id: e.id,
        employeeNumber: e.employee_number,
        firstName: e.first_name,
        lastName: e.last_name,
        email: e.email,
        position: e.position,
        department: e.departments?.code || "",
        departmentId: e.department_id,
        status: e.status as "employed" | "parental_leave" | "sick_leave" | "terminated",
        terminationDate: e.termination_date,
        notes: e.notes,
      }));

      setEmployees(transformedData);
    } catch (err: any) {
      console.error("Error fetching employees:", err);
      setError("Nepodařilo se načíst zaměstnance. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  return { employees, loading, error, refetch: fetchEmployees };
}

export function useInactiveEmployees() {
  const [employees, setEmployees] = useState<EmployeeWithDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInactiveEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("employees")
        .select(`
          id,
          employee_number,
          first_name,
          last_name,
          email,
          position,
          status,
          termination_date,
          notes,
          department_id,
          departments (
            id,
            code,
            name
          )
        `)
        .in("status", ["parental_leave", "sick_leave", "terminated"])
        .order("last_name", { ascending: true });

      if (fetchError) throw fetchError;

      const transformedData: EmployeeWithDepartment[] = (data || []).map((e: any) => ({
        id: e.id,
        employeeNumber: e.employee_number,
        firstName: e.first_name,
        lastName: e.last_name,
        email: e.email,
        position: e.position,
        department: e.departments?.code || "",
        departmentId: e.department_id,
        status: e.status as "employed" | "parental_leave" | "sick_leave" | "terminated",
        terminationDate: e.termination_date,
        notes: e.notes,
      }));

      setEmployees(transformedData);
    } catch (err: any) {
      console.error("Error fetching inactive employees:", err);
      setError("Nepodařilo se načíst neaktivní zaměstnance. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInactiveEmployees();
  }, [fetchInactiveEmployees]);

  return { employees, loading, error, refetch: fetchInactiveEmployees };
}
