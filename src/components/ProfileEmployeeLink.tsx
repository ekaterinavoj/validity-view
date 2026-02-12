import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Unlink, Check, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface ProfileEmployeeLinkProps {
  profileId: string;
  currentEmployeeId: string | null;
  onLinkChanged?: () => void;
}

export function ProfileEmployeeLink({
  profileId,
  currentEmployeeId,
  onLinkChanged,
}: ProfileEmployeeLinkProps) {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [linkedEmployees, setLinkedEmployees] = useState<Set<string>>(new Set());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    currentEmployeeId || ""
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Sync selectedEmployeeId when currentEmployeeId prop changes
  useEffect(() => {
    setSelectedEmployeeId(currentEmployeeId || "");
  }, [currentEmployeeId]);

  useEffect(() => {
    loadEmployeesAndLinks();
  }, []);

  const loadEmployeesAndLinks = async () => {
    try {
      // Load all employees
      const { data: employeesData, error: employeesError } = await supabase
        .from("employees")
        .select("id, employee_number, first_name, last_name, email")
        .order("last_name");

      if (employeesError) throw employeesError;

      // Load all profile-employee links to know which are already taken
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, employee_id")
        .not("employee_id", "is", null);

      if (profilesError) throw profilesError;

      setEmployees(employeesData || []);
      
      // Build set of already linked employee IDs (excluding current profile)
      const linked = new Set<string>();
      profilesData?.forEach((p) => {
        if (p.employee_id && p.id !== profileId) {
          linked.add(p.employee_id);
        }
      });
      setLinkedEmployees(linked);
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst zaměstnance.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedEmployeeId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ employee_id: selectedEmployeeId })
        .eq("id", profileId);

      if (error) {
        // Detect unique constraint violation
        if (error.code === "23505" || error.message?.includes("profiles_employee_id_unique")) {
          toast({
            title: "Zaměstnanec již přiřazen",
            description: "Tento zaměstnanec je již přiřazen jinému uživatelskému účtu.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Propojení uloženo",
        description: "Uživatel byl propojen se zaměstnancem.",
      });

      // Refresh linked list to reflect changes
      await loadEmployeesAndLinks();
      onLinkChanged?.();
    } catch (error: any) {
      toast({
        title: "Chyba při propojování",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlink = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ employee_id: null })
        .eq("id", profileId);

      if (error) throw error;

      setSelectedEmployeeId("");

      toast({
        title: "Propojení zrušeno",
        description: "Uživatel již není propojen se zaměstnancem.",
      });

      // Refresh linked list to reflect changes
      await loadEmployeesAndLinks();
      onLinkChanged?.();
    } catch (error: any) {
      toast({
        title: "Chyba při odpojování",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  const currentEmployee = employees.find((e) => e.id === currentEmployeeId);

  return (
    <div className="flex items-center gap-2">
      {currentEmployeeId ? (
        <>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1 text-xs">
                  <Link2 className="h-3 w-3" />
                  {currentEmployee
                    ? `${currentEmployee.first_name} ${currentEmployee.last_name} (${currentEmployee.employee_number})`
                    : "Propojeno"}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Manažer/uživatel vidí pouze záznamy svého podstromu zaměstnanců</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUnlink}
            disabled={isSaving}
            className="h-7 px-2 text-xs"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Unlink className="h-3 w-3" />
            )}
          </Button>
        </>
      ) : (
        <>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertCircle className="h-3 w-3" />
                  Nepropojeno
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Bez propojení manažer/uživatel nevidí žádné záznamy. Admin vidí vše i bez propojení.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="w-48 h-7 text-xs">
              <SelectValue placeholder="Vybrat zaměstnance..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => {
                const isLinked = linkedEmployees.has(emp.id);
                return (
                  <SelectItem
                    key={emp.id}
                    value={emp.id}
                    disabled={isLinked}
                    className="text-xs"
                  >
                    {emp.first_name} {emp.last_name} ({emp.employee_number})
                    {isLinked && " - již přiřazen"}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLink}
            disabled={!selectedEmployeeId || isSaving}
            className="h-7 px-2 text-xs"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
        </>
      )}
    </div>
  );
}