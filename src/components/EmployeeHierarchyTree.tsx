import { useState } from "react";
import { ChevronDown, ChevronRight, User, Users } from "lucide-react";
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

function buildTree(employees: Employee[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  for (const emp of employees) {
    map.set(emp.id, { employee: emp, children: [] });
  }

  // Build parent-child relationships
  for (const emp of employees) {
    const node = map.get(emp.id)!;
    if (emp.managerEmployeeId && map.has(emp.managerEmployeeId)) {
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
  const tree = buildTree(employees);

  if (tree.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Žádní zaměstnanci k zobrazení.
      </p>
    );
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      {tree
        .sort((a, b) => a.employee.lastName.localeCompare(b.employee.lastName))
        .map((node) => (
          <TreeNodeComponent key={node.employee.id} node={node} />
        ))}
    </div>
  );
}
