-- Create junction table for equipment responsible persons (allows multiple persons per equipment)
CREATE TABLE public.equipment_responsibles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(equipment_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.equipment_responsibles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Approved users can view equipment responsibles"
ON public.equipment_responsibles
FOR SELECT
USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can insert equipment responsibles"
ON public.equipment_responsibles
FOR INSERT
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update equipment responsibles"
ON public.equipment_responsibles
FOR UPDATE
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete equipment responsibles"
ON public.equipment_responsibles
FOR DELETE
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')) AND is_user_approved(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_equipment_responsibles_equipment_id ON public.equipment_responsibles(equipment_id);
CREATE INDEX idx_equipment_responsibles_profile_id ON public.equipment_responsibles(profile_id);