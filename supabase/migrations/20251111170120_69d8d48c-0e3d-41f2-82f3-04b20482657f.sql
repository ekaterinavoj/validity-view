-- Vytvoření enum pro role
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

-- Vytvoření tabulky user_roles (oddělená od profiles kvůli bezpečnosti)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- Enable Row Level Security
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Každý může vidět role (potřebné pro UI)
CREATE POLICY "Anyone can view user roles"
ON public.user_roles
FOR SELECT
USING (true);

-- Pouze admin může přidávat role
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Pouze admin může upravovat role
CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Pouze admin může mazat role
CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Security definer funkce pro kontrolu role (prevence RLS rekurze)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Funkce pro získání všech rolí uživatele
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- Funkce pro automatické přidání základní role "user" při registraci
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Přiřadit základní roli "user" novému uživateli
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger pro automatické přiřazení role při vytvoření profilu
CREATE TRIGGER assign_default_role_on_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_role();

-- Aktualizace RLS politik pro training_types - pouze admin a manager mohou upravovat
DROP POLICY IF EXISTS "Authenticated users can insert training types" ON public.training_types;
DROP POLICY IF EXISTS "Authenticated users can update training types" ON public.training_types;
DROP POLICY IF EXISTS "Authenticated users can delete training types" ON public.training_types;

CREATE POLICY "Admins and managers can insert training types"
ON public.training_types
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins and managers can update training types"
ON public.training_types
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins and managers can delete training types"
ON public.training_types
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Aktualizace RLS politik pro employees - pouze admin a manager mohou upravovat
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can update employees" ON public.employees;

CREATE POLICY "Admins and managers can insert employees"
ON public.employees
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins and managers can update employees"
ON public.employees
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Aktualizace RLS politik pro departments
DROP POLICY IF EXISTS "Authenticated users can insert departments" ON public.departments;

CREATE POLICY "Admins and managers can insert departments"
ON public.departments
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins and managers can update departments"
ON public.departments
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins and managers can delete departments"
ON public.departments
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);

-- Aktualizace RLS politik pro trainings - pouze admin a manager mohou mazat
DROP POLICY IF EXISTS "Authenticated users can delete trainings" ON public.trainings;

CREATE POLICY "Admins and managers can delete trainings"
ON public.trainings
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'manager')
);