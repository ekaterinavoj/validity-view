
-- Add document_number column to all 3 document tables
ALTER TABLE training_documents ADD COLUMN IF NOT EXISTS document_number text;
ALTER TABLE deadline_documents ADD COLUMN IF NOT EXISTS document_number text;
ALTER TABLE medical_examination_documents ADD COLUMN IF NOT EXISTS document_number text;

-- Create sequences for each module
CREATE SEQUENCE IF NOT EXISTS training_doc_seq START 1;
CREATE SEQUENCE IF NOT EXISTS deadline_doc_seq START 1;
CREATE SEQUENCE IF NOT EXISTS medical_doc_seq START 1;

-- Function to generate document number for training documents
CREATE OR REPLACE FUNCTION generate_training_doc_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.document_number IS NULL THEN
    NEW.document_number := 'TRN-' || LPAD(nextval('training_doc_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Function to generate document number for deadline documents
CREATE OR REPLACE FUNCTION generate_deadline_doc_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.document_number IS NULL THEN
    NEW.document_number := 'DL-' || LPAD(nextval('deadline_doc_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Function to generate document number for medical documents
CREATE OR REPLACE FUNCTION generate_medical_doc_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.document_number IS NULL THEN
    NEW.document_number := 'MED-' || LPAD(nextval('medical_doc_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trg_training_doc_number ON training_documents;
CREATE TRIGGER trg_training_doc_number
  BEFORE INSERT ON training_documents
  FOR EACH ROW EXECUTE FUNCTION generate_training_doc_number();

DROP TRIGGER IF EXISTS trg_deadline_doc_number ON deadline_documents;
CREATE TRIGGER trg_deadline_doc_number
  BEFORE INSERT ON deadline_documents
  FOR EACH ROW EXECUTE FUNCTION generate_deadline_doc_number();

DROP TRIGGER IF EXISTS trg_medical_doc_number ON medical_examination_documents;
CREATE TRIGGER trg_medical_doc_number
  BEFORE INSERT ON medical_examination_documents
  FOR EACH ROW EXECUTE FUNCTION generate_medical_doc_number();

-- Backfill existing documents with numbers (ordered by uploaded_at)
DO $$
DECLARE
  rec RECORD;
  counter INTEGER := 0;
BEGIN
  -- Set sequences to start after existing count
  -- Training documents
  counter := 0;
  FOR rec IN SELECT id FROM training_documents WHERE document_number IS NULL ORDER BY uploaded_at ASC LOOP
    counter := counter + 1;
    UPDATE training_documents SET document_number = 'TRN-' || LPAD(counter::text, 5, '0') WHERE id = rec.id;
  END LOOP;
  IF counter > 0 THEN
    PERFORM setval('training_doc_seq', counter);
  END IF;

  -- Deadline documents
  counter := 0;
  FOR rec IN SELECT id FROM deadline_documents WHERE document_number IS NULL ORDER BY uploaded_at ASC LOOP
    counter := counter + 1;
    UPDATE deadline_documents SET document_number = 'DL-' || LPAD(counter::text, 5, '0') WHERE id = rec.id;
  END LOOP;
  IF counter > 0 THEN
    PERFORM setval('deadline_doc_seq', counter);
  END IF;

  -- Medical examination documents
  counter := 0;
  FOR rec IN SELECT id FROM medical_examination_documents WHERE document_number IS NULL ORDER BY uploaded_at ASC LOOP
    counter := counter + 1;
    UPDATE medical_examination_documents SET document_number = 'MED-' || LPAD(counter::text, 5, '0') WHERE id = rec.id;
  END LOOP;
  IF counter > 0 THEN
    PERFORM setval('medical_doc_seq', counter);
  END IF;
END;
$$;
