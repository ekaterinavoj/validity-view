-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_number TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  position TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  status TEXT NOT NULL CHECK (status IN ('employed', 'parental_leave', 'sick_leave', 'terminated')),
  termination_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training_types table
CREATE TABLE public.training_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  facility TEXT NOT NULL,
  period_days INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trainings table
CREATE TABLE public.trainings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  training_type_id UUID NOT NULL REFERENCES public.training_types(id) ON DELETE CASCADE,
  facility TEXT NOT NULL,
  last_training_date DATE NOT NULL,
  next_training_date DATE NOT NULL,
  trainer TEXT,
  company TEXT,
  requester TEXT,
  reminder_template TEXT,
  remind_days_before INTEGER DEFAULT 30,
  repeat_days_after INTEGER DEFAULT 30,
  note TEXT,
  status TEXT NOT NULL CHECK (status IN ('valid', 'warning', 'expired')) DEFAULT 'valid',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for departments
CREATE POLICY "Anyone can view departments"
ON public.departments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert departments"
ON public.departments FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for employees
CREATE POLICY "Anyone can view employees"
ON public.employees FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert employees"
ON public.employees FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update employees"
ON public.employees FOR UPDATE
TO authenticated
USING (true);

-- RLS Policies for training_types
CREATE POLICY "Anyone can view training types"
ON public.training_types FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert training types"
ON public.training_types FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for trainings
CREATE POLICY "Anyone can view trainings"
ON public.trainings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert trainings"
ON public.trainings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update trainings"
ON public.trainings FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete trainings"
ON public.trainings FOR DELETE
TO authenticated
USING (true);

-- Create indexes
CREATE INDEX idx_employees_employee_number ON public.employees(employee_number);
CREATE INDEX idx_employees_department ON public.employees(department_id);
CREATE INDEX idx_trainings_employee ON public.trainings(employee_id);
CREATE INDEX idx_trainings_type ON public.trainings(training_type_id);
CREATE INDEX idx_trainings_status ON public.trainings(status);
CREATE INDEX idx_trainings_next_date ON public.trainings(next_training_date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trainings_updated_at
BEFORE UPDATE ON public.trainings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate training status
CREATE OR REPLACE FUNCTION public.calculate_training_status(next_date DATE)
RETURNS TEXT AS $$
BEGIN
  IF next_date < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF next_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN 'warning';
  ELSE
    RETURN 'valid';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;