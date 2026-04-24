-- Odstranění duplicitní (a nedostatečně přísné) DELETE policy
-- pro storage bucket 'training-documents'.
-- Stará policy 'Users can delete their own training documents' kontrolovala
-- pouze vlastnictví složky podle UUID v cestě a NEKONTROLOVALA, zda je
-- uživatel schválený. Ponecháváme přísnější 'training_docs_delete_authorized'.
DROP POLICY IF EXISTS "Users can delete their own training documents" ON storage.objects;