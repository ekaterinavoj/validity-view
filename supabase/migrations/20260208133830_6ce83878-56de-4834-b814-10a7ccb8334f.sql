-- ===========================================
-- PLP Module (Pracovně lékařské prohlídky)
-- Fixed order: create templates before examinations
-- ===========================================

-- 1. Medical Reminder Templates (FIRST - referenced by examinations)
CREATE TABLE public.medical_reminder_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  remind_days_before INTEGER NOT NULL DEFAULT 30,
  repeat_interval_days INTEGER,
  target_user_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_reminder_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view medical reminder templates based on role"
  ON public.medical_reminder_templates FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    (is_active = true AND is_user_approved(auth.uid()))
  );

CREATE POLICY "Admins and managers can insert medical reminder templates"
  ON public.medical_reminder_templates FOR INSERT
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can update medical reminder templates"
  ON public.medical_reminder_templates FOR UPDATE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can delete medical reminder templates"
  ON public.medical_reminder_templates FOR DELETE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

-- 2. Examination Types Table
CREATE TABLE public.medical_examination_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  facility TEXT NOT NULL,
  period_days INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_examination_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view examination types"
  ON public.medical_examination_types FOR SELECT
  USING (is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can insert examination types"
  ON public.medical_examination_types FOR INSERT
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can update examination types"
  ON public.medical_examination_types FOR UPDATE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

CREATE POLICY "Admins and managers can delete examination types"
  ON public.medical_examination_types FOR DELETE
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND is_user_approved(auth.uid()));

-- 3. Medical Examinations Table
CREATE TABLE public.medical_examinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  examination_type_id UUID NOT NULL REFERENCES public.medical_examination_types(id),
  facility TEXT NOT NULL,
  last_examination_date DATE NOT NULL,
  next_examination_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid',
  doctor TEXT,
  medical_facility TEXT,
  result TEXT,
  note TEXT,
  reminder_template_id UUID REFERENCES public.medical_reminder_templates(id),
  remind_days_before INTEGER DEFAULT 30,
  repeat_days_after INTEGER DEFAULT 30,
  requester TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_examinations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_medical_examinations_updated_at
  BEFORE UPDATE ON public.medical_examinations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Role-based examinations visibility"
  ON public.medical_examinations FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND 
    is_user_approved(auth.uid()) AND 
    has_module_access(auth.uid(), 'plp') AND 
    (
      has_role(auth.uid(), 'admin'::app_role) OR 
      is_manager_of(auth.uid(), employee_id) OR 
      employee_id = get_user_employee_id(auth.uid())
    )
  );

CREATE POLICY "Users can insert examinations"
  ON public.medical_examinations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    auth.uid() = created_by AND 
    is_user_approved(auth.uid()) AND 
    has_module_access(auth.uid(), 'plp')
  );

CREATE POLICY "Users can update examinations"
  ON public.medical_examinations FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND 
    is_user_approved(auth.uid()) AND 
    has_module_access(auth.uid(), 'plp') AND 
    (
      has_role(auth.uid(), 'admin'::app_role) OR 
      (has_role(auth.uid(), 'manager'::app_role) AND is_manager_of(auth.uid(), employee_id)) OR 
      created_by = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can delete examinations"
  ON public.medical_examinations FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND 
    is_user_approved(auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

-- 4. Medical Examination Documents
CREATE TABLE public.medical_examination_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  examination_id UUID NOT NULL REFERENCES public.medical_examinations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  document_type TEXT NOT NULL,
  description TEXT,
  uploaded_by UUID,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_examination_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view examination documents"
  ON public.medical_examination_documents FOR SELECT
  USING (is_user_approved(auth.uid()));

CREATE POLICY "Approved users can upload examination documents"
  ON public.medical_examination_documents FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

CREATE POLICY "Users can delete their own examination documents"
  ON public.medical_examination_documents FOR DELETE
  USING (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

-- 5. Medical Reminder Logs
CREATE TABLE public.medical_reminder_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  examination_id UUID REFERENCES public.medical_examinations(id),
  employee_id UUID,
  template_id UUID REFERENCES public.medical_reminder_templates(id),
  template_name TEXT NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  days_before INTEGER,
  delivery_mode TEXT DEFAULT 'bcc',
  week_start DATE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view medical reminder logs"
  ON public.medical_reminder_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert medical reminder logs"
  ON public.medical_reminder_logs FOR INSERT
  WITH CHECK (true);

-- 6. Storage bucket for medical documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('medical-documents', 'medical-documents', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Users can view medical documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'medical-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload medical documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'medical-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their medical documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'medical-documents' AND auth.role() = 'authenticated');

-- 7. Status calculation function
CREATE OR REPLACE FUNCTION public.calculate_examination_status(next_date date)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF next_date < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF next_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    RETURN 'warning';
  ELSE
    RETURN 'valid';
  END IF;
END;
$$;