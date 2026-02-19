
-- Create general_documents table for the Documentation module
CREATE TABLE public.general_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.general_documents ENABLE ROW LEVEL SECURITY;

-- Approved users can view all documents
CREATE POLICY "Approved users can view general documents"
ON public.general_documents
FOR SELECT
USING (is_user_approved(auth.uid()));

-- Approved users can upload documents
CREATE POLICY "Approved users can upload general documents"
ON public.general_documents
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by AND is_user_approved(auth.uid()));

-- Admins and managers can delete documents
CREATE POLICY "Admins and managers can delete general documents"
ON public.general_documents
FOR DELETE
USING (
  is_user_approved(auth.uid()) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR auth.uid() = uploaded_by
  )
);

-- Create storage bucket for general documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('general-documents', 'general-documents', false);

-- Storage policies
CREATE POLICY "Approved users can upload general docs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'general-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Approved users can view general docs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'general-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete general docs"
ON storage.objects
FOR DELETE
USING (bucket_id = 'general-documents' AND auth.role() = 'authenticated');
