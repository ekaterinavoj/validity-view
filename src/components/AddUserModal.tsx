import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Eye, EyeOff, RefreshCw } from "lucide-react";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  employee_number: string | null;
}

interface AddUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
}

function generatePassword(length = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function AddUserModal({ open, onOpenChange, onUserCreated }: AddUserModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "manager" | "admin">("user");
  const [moduleTrainings, setModuleTrainings] = useState(true);
  const [moduleDeadlines, setModuleDeadlines] = useState(true);
  const [modulePlp, setModulePlp] = useState(true);
  const [employeeId, setEmployeeId] = useState("");

  useEffect(() => {
    if (open) {
      loadEmployees();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setPassword(generatePassword());
    setRole("user");
    setModuleTrainings(true);
    setModuleDeadlines(true);
    setModulePlp(true);
    setEmployeeId("");
  };

  const loadEmployees = async () => {
    setEmployeesLoading(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email, employee_number")
        .eq("status", "employed")
        .order("last_name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání zaměstnanců",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEmployeesLoading(false);
    }
  };

  const handleEmployeeSelect = (empId: string) => {
    setEmployeeId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setFirstName(emp.first_name);
      setLastName(emp.last_name);
      if (emp.email && !email) {
        setEmail(emp.email);
      }
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    const isAdminRole = role === "admin";
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      toast({
        title: "Vyplňte povinná pole",
        description: "Email a heslo jsou povinné.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast({
        title: "Neplatný email",
        description: "Zadejte platnou emailovou adresu.",
        variant: "destructive",
      });
      return;
    }

    if (!isAdminRole && !employeeId) {
      toast({
        title: "Vyplňte povinná pole",
        description: "Propojení se zaměstnancem je povinné pro role Uživatel a Manažer.",
        variant: "destructive",
      });
      return;
    }

    // NEW: non-admin must have at least one module selected
    if (!isAdminRole && !moduleTrainings && !moduleDeadlines && !modulePlp) {
      toast({
        title: "Vyberte modul",
        description: "Uživatel musí mít přístup alespoň k jednomu modulu.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const modules: string[] = [];
      if (moduleTrainings) modules.push("trainings");
      if (moduleDeadlines) modules.push("deadlines");
      if (modulePlp) modules.push("plp");

      // NEW: build payload without employeeId for admin
      const payload: any = {
        email: trimmedEmail,
        password: trimmedPassword,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        role,
        modules: role === "admin" ? ["trainings", "deadlines", "plp"] : modules,
      };

      if (!isAdminRole) {
        payload.employeeId = employeeId;
      }

      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) {
        // User-friendly message for duplicate email
        const errMsg: string = data.error;
        if (errMsg.toLowerCase().includes("already") || errMsg.toLowerCase().includes("exists") || errMsg.toLowerCase().includes("duplicate") || errMsg.toLowerCase().includes("již existuje")) {
          throw new Error(`Uživatel s emailem ${trimmedEmail} již v systému existuje.`);
        }
        throw new Error(errMsg);
      }

      toast({
        title: "Uživatel vytvořen",
        description: `Účet pro ${trimmedEmail} byl úspěšně vytvořen.`,
      });

      onUserCreated();
      handleOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Chyba při vytváření uživatele",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = role === "admin";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Přidat nového uživatele</DialogTitle>
          <DialogDescription>Vytvořte nový uživatelský účet a přidělte mu přístup do systému.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Role - moved to top so we know if admin is selected */}
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Uživatel</SelectItem>
                <SelectItem value="manager">Manažer</SelectItem>
                <SelectItem value="admin">Administrátor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Employee Link - only required for non-admin */}
          {!isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="employee">
                Propojení se zaměstnancem <span className="text-destructive">*</span>
              </Label>
              {employeesLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Načítání zaměstnanců...
                </div>
              ) : (
                <Select value={employeeId} onValueChange={handleEmployeeSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte zaměstnance" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.last_name} {emp.first_name}{emp.employee_number ? ` (${emp.employee_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">Propojení určuje, které záznamy uživatel uvidí v systému.</p>
            </div>
          )}

          {isAdmin && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Administrátor</strong> má přístup ke všem datům a nepotřebuje propojení se zaměstnancem.
              </p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="uzivatel@firma.cz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Jméno</Label>
              <Input
                id="firstName"
                placeholder="Jan"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Příjmení</Label>
              <Input id="lastName" placeholder="Novák" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">
              Počáteční heslo <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPassword(generatePassword())}
                title="Vygenerovat nové heslo"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Heslo předejte uživateli bezpečným způsobem.</p>
          </div>

          {/* Modules - disabled for admin */}
          <div className="space-y-2">
            <Label>Přístup k modulům</Label>
            {isAdmin ? (
              <p className="text-sm text-muted-foreground">Administrátor má automaticky přístup ke všem modulům.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="module-trainings"
                    checked={moduleTrainings}
                    onCheckedChange={(checked) => setModuleTrainings(!!checked)}
                  />
                  <Label htmlFor="module-trainings" className="font-normal cursor-pointer">
                    Školení
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="module-deadlines"
                    checked={moduleDeadlines}
                    onCheckedChange={(checked) => setModuleDeadlines(!!checked)}
                  />
                  <Label htmlFor="module-deadlines" className="font-normal cursor-pointer">
                    Technické lhůty
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="module-plp"
                    checked={modulePlp}
                    onCheckedChange={(checked) => setModulePlp(!!checked)}
                  />
                  <Label htmlFor="module-plp" className="font-normal cursor-pointer">
                    Lékařské prohlídky (PLP)
                  </Label>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Zrušit
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Vytvářím...
              </>
            ) : (
              "Vytvořit uživatele"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
