import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Search, X, Users } from "lucide-react";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

interface EmployeeMultiSelectProps {
  employees: Employee[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  error?: string;
}

export function EmployeeMultiSelect({
  employees,
  selectedIds,
  onChange,
  placeholder = "Vyberte zaměstnance",
  error,
}: EmployeeMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.lastName.toLowerCase().includes(q) ||
        e.firstName.toLowerCase().includes(q) ||
        e.employeeNumber.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const toggleEmployee = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    const filteredIds = filtered.map((e) => e.id);
    const allSelected = filteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter((id) => !filteredIds.includes(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredIds]);
      onChange(Array.from(merged));
    }
  };

  const removeEmployee = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const selectedEmployees = employees.filter((e) => selectedIds.includes(e.id));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={`w-full justify-between font-normal ${
              selectedIds.length === 0 ? "text-muted-foreground" : ""
            } ${error ? "border-destructive" : ""}`}
          >
            <span className="flex items-center gap-2 truncate">
              <Users className="h-4 w-4 shrink-0" />
              {selectedIds.length === 0
                ? placeholder
                : `${selectedIds.length} zaměstnanc${selectedIds.length === 1 ? "" : selectedIds.length < 5 ? "i" : "ů"} vybráno`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hledat zaměstnance..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
              {filtered.length > 0 && filtered.every((e) => selectedIds.includes(e.id))
                ? "Odznačit vše"
                : "Vybrat vše"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {filtered.length} zaměstnanců
            </span>
          </div>
          <ScrollArea className="h-[250px]">
            <div className="p-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Žádní zaměstnanci nenalezeni
                </p>
              ) : (
                filtered.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer"
                    onClick={() => toggleEmployee(emp.id)}
                  >
                    <Checkbox
                      checked={selectedIds.includes(emp.id)}
                      onCheckedChange={() => toggleEmployee(emp.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm truncate">
                      {emp.lastName} {emp.firstName} ({emp.employeeNumber})
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selectedEmployees.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedEmployees.slice(0, 10).map((emp) => (
            <Badge key={emp.id} variant="secondary" className="gap-1 pr-1">
              {emp.lastName} {emp.firstName}
              <button
                type="button"
                onClick={() => removeEmployee(emp.id)}
                className="hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedEmployees.length > 10 && (
            <Badge variant="outline">+{selectedEmployees.length - 10} dalších</Badge>
          )}
        </div>
      )}
    </div>
  );
}
