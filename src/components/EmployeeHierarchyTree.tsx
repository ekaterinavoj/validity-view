import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, User, Users, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmployeeStatusBadge, EmployeeStatus } from "./EmployeeStatusBadge";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  status: string;
  managerEmployeeId?: string | null;
}

interface TreeNode {
  employee: Employee;
  children: TreeNode[];
}

interface EmployeeHierarchyTreeProps {
  employees: Employee[];
  className?: string;
}

/**
 * Find IDs whose manager link should be broken to eliminate all cycles.
 * Strategy: for each cycle found, break at the employee whose ID is smallest
 * (deterministic, stable). Only one link per cycle needs to be cut.
 */
function findCycleBreaks(employees: Employee[]): Set<string> {
  const empMap = new Map(employees.map(e => [e.id, e]));
  const visited = new Set<string>();
  const breaks = new Set<string>();

  for (const emp of employees) {
    if (visited.has(emp.id)) continue;

    // Walk the manager chain from this employee
    const path: string[] = [];
    const pathSet = new Set<string>();
    let current: string | null | undefined = emp.id;

    while (current && !visited.has(current)) {
      if (pathSet.has(current)) {
        // Found a cycle – collect all members of this cycle
        const cycleStart = path.indexOf(current);
        const cycleMembers = path.slice(cycleStart);
        // Break at the "smallest" id in the cycle (deterministic)
        const breakId = cycleMembers.reduce((a, b) => (a < b ? a : b));
        breaks.add(breakId);
        break;
      }
      path.push(current);
      pathSet.add(current);
      current = empMap.get(current)?.managerEmployeeId;
    }

    // Mark all nodes in this path as visited
    for (const id of path) visited.add(id);
  }

  return breaks;
}

function buildTree(employees: Employee[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const emp of employees) {
    map.set(emp.id, { employee: emp, children: [] });
  }

  const cycleBreaks = findCycleBreaks(employees);

  for (const emp of employees) {
    const node = map.get(emp.id)!;
    if (
      emp.managerEmployeeId &&
      map.has(emp.managerEmployeeId) &&
      !cycleBreaks.has(emp.id)
    ) {
      map.get(emp.managerEmployeeId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function TreeNodeComponent({ node, level = 0 }: { node: TreeNode; level?: number }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer text-sm",
          level === 0 && "font-medium"
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {hasChildren ? (
          <Users className="w-4 h-4 text-primary shrink-0" />
        ) : (
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
        )}

        <span className="truncate">
          {node.employee.lastName} {node.employee.firstName}
        </span>

        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
          {node.employee.position}
        </span>

        {hasChildren && (
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            ({node.children.length})
          </span>
        )}

        <EmployeeStatusBadge status={node.employee.status as EmployeeStatus} />
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children
            .sort((a, b) => a.employee.lastName.localeCompare(b.employee.lastName))
            .map((child) => (
              <TreeNodeComponent key={child.employee.id} node={child} level={level + 1} />
            ))}
        </div>
      )}
    </div>
  );
}

export function EmployeeHierarchyTree({ employees, className }: EmployeeHierarchyTreeProps) {
  // Skryjeme ukončené zaměstnance ze stromu (zůstávají v plochém přehledu).
  // Aktivní + mateřská + nemocenská se zobrazují normálně.
  // Pokud má ukončený zaměstnanec podřízené, jeho přímí podřízení se „povýší"
  // pod jeho původního manažera (skutečný strom hierarchie pro aktivní lidi).
  const { visibleEmployees, hiddenCount } = useMemo(() => {
    const byId = new Map(employees.map((e) => [e.id, e]));
    const isHidden = (e: Employee) => e.status === "terminated";

    /** Najde nejbližšího aktivního manažera procházením řetězce nahoru. */
    const resolveManager = (startId: string | null | undefined): string | null => {
      const seen = new Set<string>();
      let current = startId ?? null;
      while (current) {
        if (seen.has(current)) return null; // safety proti cyklu
        seen.add(current);
        const mgr = byId.get(current);
        if (!mgr) return null;
        if (!isHidden(mgr)) return mgr.id;
        current = mgr.managerEmployeeId ?? null;
      }
      return null;
    };

    const hidden = employees.filter(isHidden).length;
    const visible = employees
      .filter((e) => !isHidden(e))
      .map((e) => ({ ...e, managerEmployeeId: resolveManager(e.managerEmployeeId) }));

    return { visibleEmployees: visible, hiddenCount: hidden };
  }, [employees]);

  const tree = buildTree(visibleEmployees);

  if (tree.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Žádní zaměstnanci k zobrazení.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {hiddenCount > 0 && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-md px-3 py-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <p>
            Ve stromu je <strong>skryto {hiddenCount}</strong>{" "}
            {hiddenCount === 1 ? "ukončený zaměstnanec" : hiddenCount < 5 ? "ukončení zaměstnanci" : "ukončených zaměstnanců"}.
            Bývalý nadřízený je vidí v <strong>tabulkovém zobrazení</strong> po nastavení filtru
            stavu na <em>„Ukončený"</em> nebo <em>„Všichni"</em>.
          </p>
        </div>
      )}
      <div className="space-y-0.5">
        {tree
          .sort((a, b) => a.employee.lastName.localeCompare(b.employee.lastName))
          .map((node) => (
            <TreeNodeComponent key={node.employee.id} node={node} />
          ))}
      </div>
    </div>
  );
}
