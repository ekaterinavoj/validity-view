import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  [key: string]: any;
}

interface EmployeeOrCustomInputProps {
  employees: Employee[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  /** When provided, shows a "None" option at the top that triggers onNone */
  noneLabel?: string;
  onNone?: () => void;
}

export function EmployeeOrCustomInput({
  employees,
  value,
  onChange,
  placeholder = "Vyberte nebo zadejte jméno",
  disabled = false,
  noneLabel,
  onNone,
}: EmployeeOrCustomInputProps) {
  const [open, setOpen] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  // Check if current value matches an employee
  const selectedEmployee = useMemo(() => {
    if (!value) return null;
    return employees.find(
      (e) => `${e.firstName} ${e.lastName}` === value || `${e.lastName} ${e.firstName}` === value
    );
  }, [value, employees]);

  const handleSelectEmployee = (employee: Employee) => {
    onChange(`${employee.firstName} ${employee.lastName}`);
    setIsCustom(false);
    setOpen(false);
  };

  const handleSwitchToCustom = () => {
    setIsCustom(true);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsCustom(false);
  };

  if (isCustom) {
    return (
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setIsCustom(false);
            onChange("");
          }}
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={disabled}
            type="button"
          >
            {value ? (
              <span className="truncate">
                {value}
                {selectedEmployee && (
                  <span className="text-muted-foreground ml-1">({selectedEmployee.email})</span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0 z-50" align="start">
          <Command>
            <CommandInput placeholder="Hledat zaměstnance..." />
            <CommandList>
              <CommandEmpty>Žádný zaměstnanec nenalezen.</CommandEmpty>
              {noneLabel && onNone && (
                <CommandGroup>
                  <CommandItem
                    value="__none__"
                    onSelect={() => {
                      onNone();
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-muted-foreground font-medium">{noneLabel}</span>
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Zaměstnanci">
                {employees.map((employee) => {
                  const fullName = `${employee.firstName} ${employee.lastName}`;
                  return (
                    <CommandItem
                      key={employee.id}
                      value={`${fullName} ${employee.email}`}
                      onSelect={() => handleSelectEmployee(employee)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === fullName ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{employee.lastName} {employee.firstName}</span>
                        <span className="text-xs text-muted-foreground">{employee.email}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandGroup>
                <CommandItem onSelect={handleSwitchToCustom}>
                  <span className="text-primary">✏️ Zadat ručně...</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
