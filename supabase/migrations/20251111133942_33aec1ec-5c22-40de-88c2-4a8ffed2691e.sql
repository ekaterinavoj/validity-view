-- Create storage bucket for training documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-documents', 'training-documents', false);

-- Create table for training document metadata
CREATE TABLE public.training_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('certificate', 'attendance_sheet', 'protocol', 'other')),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),
  description TEXT
);

-- Enable RLS
ALTER TABLE public.training_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training_documents
-- Allow authenticated users to view all documents
CREATE POLICY "Users can view training documents"
ON public.training_documents
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert documents
CREATE POLICY "Users can upload training documents"
ON public.training_documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

-- Allow authenticated users to delete their own documents
CREATE POLICY "Users can delete their own documents"
ON public.training_documents
FOR DELETE
TO authenticated
USING (auth.uid() = uploaded_by);

-- Storage policies for training-documents bucket
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload training documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'training-documents');

-- Allow authenticated users to view files
CREATE POLICY "Users can view training documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'training-documents');

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own training documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'training-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create index for faster queries
CREATE INDEX idx_training_documents_training_id ON public.training_documents(training_id);
CREATE INDEX idx_training_documents_uploaded_by ON public.training_documents(uploaded_by);