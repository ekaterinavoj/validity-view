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
  statusStartDate?: string;
  notes?: string;
  workCategory?: number | null;
  // Manager hierarchy – resolved via JOIN
  managerEmployeeId?: string | null;
  managerFirstName?: string | null;
  managerLastName?: string | null;
  managerEmail?: string | null;
}

function mapEmployee(e: any): EmployeeWithDepartment {
  return {
    id: e.id,
    employeeNumber: e.employee_number,
    firstName: e.first_name,
    lastName: e.last_name,
    email: e.email,
    position: e.position,
    department: e.departments?.code || "",
    departmentId: e.department_id,
    status: e.status as EmployeeWithDepartment["status"],
    terminationDate: e.termination_date,
    statusStartDate: e.status_start_date,
    notes: e.notes,
    workCategory: e.work_category,
    managerEmployeeId: e.manager_employee_id,
    // Will be resolved after fetch from the employee list itself
    managerFirstName: null,
    managerLastName: null,
    managerEmail: null,
  };
}

/** Resolve manager names from the flat employee list (avoids PostgREST self-join issues) */
function resolveManagers(employees: EmployeeWithDepartment[]): EmployeeWithDepartment[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  return employees.map((e) => {
    if (!e.managerEmployeeId) return e;
    const mgr = byId.get(e.managerEmployeeId);
    if (!mgr) return e;
    return {
      ...e,
      managerFirstName: mgr.firstName,
      managerLastName: mgr.lastName,
      managerEmail: mgr.email,
    };
  });
}

const EMPLOYEE_SELECT = `
  id,
  employee_number,
  first_name,
  last_name,
  email,
  position,
  status,
  termination_date,
  status_start_date,
  notes,
  department_id,
  work_category,
  manager_employee_id,
  departments (
    id,
    code,
    name
  )
`;

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
        .select(EMPLOYEE_SELECT)
        .order("last_name", { ascending: true });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setEmployees(resolveManagers((data || []).map(mapEmployee)));
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
        .select(EMPLOYEE_SELECT)
        .in("status", ["parental_leave", "sick_leave", "terminated"])
        .order("last_name", { ascending: true });

      if (fetchError) throw fetchError;

      setEmployees(resolveManagers((data || []).map(mapEmployee)));
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
