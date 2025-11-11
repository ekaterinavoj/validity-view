export interface Training {
  id: string;
  status: "valid" | "warning" | "expired";
  date: string;
  type: string;
  employeeNumber: string;
  employeeName: string;
  facility: string;
  department: string;
  lastTrainingDate: string;
  trainer: string;
  company: string;
  requester: string;
  period: number;
  reminderTemplate: string;
  calendar: string;
  note: string;
  protocol?: string;
  is_active?: boolean;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  department: string;
  status: "employed" | "parental_leave" | "sick_leave" | "terminated";
  terminationDate?: string;
  notes?: string;
}

export interface TrainingType {
  id: string;
  name: string;
  facility: string;
  periodDays: number;
  description?: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
}
