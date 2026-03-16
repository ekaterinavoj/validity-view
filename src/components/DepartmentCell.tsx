interface DepartmentCellProps {
  code: string;
  name?: string;
}

export function DepartmentCell({ code, name }: DepartmentCellProps) {
  if (!code) return <span className="text-muted-foreground">-</span>;
  
  return (
    <div className="leading-tight">
      <div className="font-medium">{code}</div>
      {name && name !== code && (
        <div className="text-xs text-muted-foreground">{name}</div>
      )}
    </div>
  );
}

/** Format department for CSV export: "code - name" */
export function formatDepartment(code: string, name?: string): string {
  if (!code) return "";
  if (name && name !== code) return `${code} - ${name}`;
  return code;
}
