// Lightweight reference types for joined data in lists
export interface EquipmentRef {
  id: string;
  inventory_number: string;
  name: string;
  equipment_type: string;
  facility: string;
  department_id?: string | null;
  status: string;
  location?: string | null;
  responsible_person?: string | null;
}

export interface DeadlineTypeRef {
  id: string;
  name: string;
  facility: string;
  period_days: number;
}

export interface Equipment {
  id: string;
  inventory_number: string;
  name: string;
  equipment_type: string;
  facility: string;
  department_id: string | null;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  location: string | null;
  responsible_person: string | null;
  status: "active" | "inactive" | "decommissioned";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeadlineType {
  id: string;
  name: string;
  facility: string;
  period_days: number;
  description: string | null;
  created_at: string;
}

export interface Deadline {
  id: string;
  equipment_id: string;
  deadline_type_id: string;
  facility: string;
  last_check_date: string;
  next_check_date: string;
  status: "valid" | "warning" | "expired";
  remind_days_before?: number | null;
  repeat_days_after?: number | null;
  reminder_template_id?: string | null;
  performer?: string | null;
  company?: string | null;
  requester?: string | null;
  note?: string | null;
  is_active: boolean;
  deleted_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Lightweight joined data for lists
  equipment?: EquipmentRef | null;
  deadline_type?: DeadlineTypeRef | null;
}

export interface DeadlineDocument {
  id: string;
  deadline_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  document_type: string;
  description?: string;
  uploaded_by?: string;
  uploaded_at: string;
}

export const equipmentStatusLabels: Record<string, string> = {
  active: "Aktivní",
  inactive: "Neaktivní",
  decommissioned: "Vyřazeno",
};

export const equipmentStatusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-700 dark:text-green-300",
  inactive: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  decommissioned: "bg-red-500/20 text-red-700 dark:text-red-300",
};
