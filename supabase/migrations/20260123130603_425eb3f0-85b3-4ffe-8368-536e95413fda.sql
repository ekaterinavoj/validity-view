-- Create facilities table for managing company facilities/locations
CREATE TABLE public.facilities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Approved users can view facilities" 
ON public.facilities 
FOR SELECT 
USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can insert facilities" 
ON public.facilities 
FOR INSERT 
WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update facilities" 
ON public.facilities 
FOR UPDATE 
USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete facilities" 
ON public.facilities 
FOR DELETE 
USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_facilities_updated_at
BEFORE UPDATE ON public.facilities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default facility (migrate existing data)
INSERT INTO public.facilities (code, name, description)
VALUES ('qlar-jenec-dc3', 'Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3', 'Hlavní provozovna');

-- Add index for faster lookups
CREATE INDEX idx_facilities_code ON public.facilities(code);
CREATE INDEX idx_facilities_active ON public.facilities(is_active) WHERE is_active = true;