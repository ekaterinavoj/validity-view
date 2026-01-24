-- =============================================
-- MODUL: TECHNICKÉ LHŮTY (Equipment Deadlines)
-- =============================================

-- 1. Tabulka pro zařízení (equipment)
CREATE TABLE public.equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  facility TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  description TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  location TEXT,
  responsible_person TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'decommissioned')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Typy technických lhůt (deadline types)
CREATE TABLE public.deadline_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  facility TEXT NOT NULL,
  period_days INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Hlavní tabulka technických lhůt (deadlines)
CREATE TABLE public.deadlines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id),
  deadline_type_id UUID NOT NULL REFERENCES public.deadline_types(id),
  facility TEXT NOT NULL,
  last_check_date DATE NOT NULL,
  next_check_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'warning', 'expired')),
  remind_days_before INTEGER DEFAULT 30,
  repeat_days_after INTEGER DEFAULT 30,
  reminder_template_id UUID,
  performer TEXT,
  company TEXT,
  requester TEXT,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Dokumenty k technickým lhůtám
CREATE TABLE public.deadline_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deadline_id UUID NOT NULL REFERENCES public.deadlines(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  document_type TEXT NOT NULL,
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Šablony upomínek pro technické lhůty (oddělené od školení)
CREATE TABLE public.deadline_reminder_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  remind_days_before INTEGER NOT NULL DEFAULT 30,
  repeat_interval_days INTEGER,
  target_user_ids UUID[] DEFAULT '{}'::uuid[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Logy upomínek pro technické lhůty
CREATE TABLE public.deadline_reminder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deadline_id UUID REFERENCES public.deadlines(id),
  equipment_id UUID REFERENCES public.equipment(id),
  template_id UUID REFERENCES public.deadline_reminder_templates(id),
  template_name TEXT NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  delivery_mode TEXT DEFAULT 'bcc',
  is_test BOOLEAN NOT NULL DEFAULT false,
  days_before INTEGER,
  week_start DATE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger pro aktualizaci updated_at u equipment
CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger pro aktualizaci updated_at u deadlines
CREATE TRIGGER update_deadlines_updated_at
  BEFORE UPDATE ON public.deadlines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger pro aktualizaci updated_at u deadline_reminder_templates
CREATE TRIGGER update_deadline_reminder_templates_updated_at
  BEFORE UPDATE ON public.deadline_reminder_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Funkce pro výpočet statusu technické lhůty
CREATE OR REPLACE FUNCTION public.calculate_deadline_status(next_date date)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF next_date < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF next_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN 'warning';
  ELSE
    RETURN 'valid';
  END IF;
END;
$function$;

-- Trigger pro aktualizaci is_active u deadlines při změně statusu equipment
CREATE OR REPLACE FUNCTION public.update_deadline_active_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('inactive', 'decommissioned') THEN
      UPDATE public.deadlines
      SET is_active = false
      WHERE equipment_id = NEW.id;
    ELSIF NEW.status = 'active' THEN
      UPDATE public.deadlines
      SET is_active = true
      WHERE equipment_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_deadlines_on_equipment_status
  AFTER UPDATE ON public.equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deadline_active_status();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_reminder_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_reminder_logs ENABLE ROW LEVEL SECURITY;

-- Equipment policies
CREATE POLICY "Approved users can view equipment"
  ON public.equipment FOR SELECT
  USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can insert equipment"
  ON public.equipment FOR INSERT
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update equipment"
  ON public.equipment FOR UPDATE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete equipment"
  ON public.equipment FOR DELETE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

-- Deadline types policies
CREATE POLICY "Approved users can view deadline types"
  ON public.deadline_types FOR SELECT
  USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can insert deadline types"
  ON public.deadline_types FOR INSERT
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update deadline types"
  ON public.deadline_types FOR UPDATE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete deadline types"
  ON public.deadline_types FOR DELETE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

-- Deadlines policies
CREATE POLICY "Approved users can view deadlines"
  ON public.deadlines FOR SELECT
  USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved users can insert deadlines"
  ON public.deadlines FOR INSERT
  WITH CHECK ((auth.uid() = created_by) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can update deadlines"
  ON public.deadlines FOR UPDATE
  USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete deadlines"
  ON public.deadlines FOR DELETE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

-- Deadline documents policies
CREATE POLICY "Approved users can view deadline documents"
  ON public.deadline_documents FOR SELECT
  USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved users can upload deadline documents"
  ON public.deadline_documents FOR INSERT
  WITH CHECK ((auth.uid() = uploaded_by) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can delete their own deadline documents"
  ON public.deadline_documents FOR DELETE
  USING ((auth.uid() = uploaded_by) AND is_user_approved(auth.uid()));

-- Deadline reminder templates policies
CREATE POLICY "Users can view deadline reminder templates based on role"
  ON public.deadline_reminder_templates FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR ((is_active = true) AND is_user_approved(auth.uid())));

CREATE POLICY "Approved admins and managers can insert deadline reminder templates"
  ON public.deadline_reminder_templates FOR INSERT
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can update deadline reminder templates"
  ON public.deadline_reminder_templates FOR UPDATE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Approved admins and managers can delete deadline reminder templates"
  ON public.deadline_reminder_templates FOR DELETE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

-- Deadline reminder logs policies
CREATE POLICY "Admins can view deadline reminder logs"
  ON public.deadline_reminder_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert deadline reminder logs"
  ON public.deadline_reminder_logs FOR INSERT
  WITH CHECK (true);

-- =============================================
-- STORAGE BUCKET
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('deadline-documents', 'deadline-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for deadline documents
CREATE POLICY "Approved users can view deadline documents in storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'deadline-documents' AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can upload deadline documents to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deadline-documents' AND is_user_approved(auth.uid()));

CREATE POLICY "Approved users can delete their deadline documents from storage"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'deadline-documents' AND is_user_approved(auth.uid()));