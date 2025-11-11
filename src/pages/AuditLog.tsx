import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: any;
  new_data: any;
  user_id: string;
  user_email: string;
  user_name: string;
  changed_fields: string[];
  created_at: string;
}

const actionColors = {
  INSERT: "bg-green-500/20 text-green-700 dark:text-green-300",
  UPDATE: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  DELETE: "bg-red-500/20 text-red-700 dark:text-red-300",
};

const actionLabels = {
  INSERT: "Vytvořeno",
  UPDATE: "Upraveno",
  DELETE: "Smazáno",
};

const tableLabels = {
  trainings: "Školení",
  user_roles: "Role uživatelů",
  training_types: "Typy školení",
  employees: "Zaměstnanci",
  departments: "Oddělení",
};

export default function AuditLog() {
  const { isAdmin, isManager } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isAdmin && !isManager) {
      toast({
        title: "Přístup odepřen",
        description: "Nemáte oprávnění k této stránce.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    loadLogs();
    subscribeToChanges();
  }, [isAdmin, isManager, navigate]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data, error } = await query;

      if (error) throw error;

      setLogs((data || []) as AuditLog[]);
    } catch (error: any) {
      console.error("Error loading audit logs:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst audit log.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel("audit-log-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
        },
        (payload) => {
          setLogs((prev) => [payload.new as AuditLog, ...prev]);
          toast({
            title: "Nová změna zaznamenána",
            description: `${actionLabels[payload.new.action as keyof typeof actionLabels]} - ${payload.new.user_name}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const filteredLogs = logs.filter((log) => {
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesTable = tableFilter === "all" || log.table_name === tableFilter;
    const matchesSearch =
      searchQuery === "" ||
      log.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_email.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesAction && matchesTable && matchesSearch;
  });

  const formatChangedFields = (fields: string[]) => {
    if (!fields || fields.length === 0) return "-";
    
    const fieldLabels: Record<string, string> = {
      facility: "Provozovna",
      employee_id: "Zaměstnanec",
      training_type_id: "Typ školení",
      last_training_date: "Datum školení",
      next_training_date: "Platnost do",
      trainer: "Školitel",
      company: "Firma",
      note: "Poznámka",
      status: "Stav",
      is_active: "Aktivní",
      role: "Role",
    };

    return fields.map((f) => fieldLabels[f] || f).join(", ");
  };

  if (!isAdmin && !isManager) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-8 h-8" />
            Audit log
          </h2>
          <p className="text-muted-foreground mt-2">
            Kompletní záznam všech změn provedených v systému
          </p>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b">
            <Filter className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Filtry</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Akce</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všechny akce</SelectItem>
                  <SelectItem value="INSERT">Vytvořeno</SelectItem>
                  <SelectItem value="UPDATE">Upraveno</SelectItem>
                  <SelectItem value="DELETE">Smazáno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tabulka</label>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všechny tabulky</SelectItem>
                  <SelectItem value="trainings">Školení</SelectItem>
                  <SelectItem value="user_roles">Role uživatelů</SelectItem>
                  <SelectItem value="training_types">Typy školení</SelectItem>
                  <SelectItem value="employees">Zaměstnanci</SelectItem>
                  <SelectItem value="departments">Oddělení</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Hledat uživatele</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Jméno nebo email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-4 border-b">
            <h3 className="text-lg font-semibold">Záznamy změn</h3>
            <Badge variant="secondary">{filteredLogs.length} záznamů</Badge>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Žádné záznamy odpovídající filtrům</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum a čas</TableHead>
                    <TableHead>Akce</TableHead>
                    <TableHead>Tabulka</TableHead>
                    <TableHead>Uživatel</TableHead>
                    <TableHead>Změněná pole</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), "d. M. yyyy HH:mm:ss", {
                          locale: cs,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge className={actionColors[log.action]}>
                          {actionLabels[log.action]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tableLabels[log.table_name as keyof typeof tableLabels] ||
                          log.table_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{log.user_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {log.user_email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="text-sm">
                          {formatChangedFields(log.changed_fields)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 bg-muted/50">
        <h3 className="text-lg font-semibold mb-4">O audit logu</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Audit log automaticky zaznamenává všechny změny provedené v systému
          </p>
          <p>
            • Zobrazuje se posledních 100 záznamů seřazených od nejnovějších
          </p>
          <p>
            • Změny jsou zobrazovány v reálném čase díky live aktualizacím
          </p>
          <p>
            • Přístup k audit logu mají pouze administrátoři a manažeři
          </p>
          <p>
            • Audit logy nelze upravovat ani mazat (zajištěno databázovými politikami)
          </p>
        </div>
      </Card>
    </div>
  );
}
