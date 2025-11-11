-- Add UPDATE and DELETE policies for training_types table
CREATE POLICY "Authenticated users can update training types"
ON public.training_types
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete training types"
ON public.training_types
FOR DELETE
TO authenticated
USING (true);