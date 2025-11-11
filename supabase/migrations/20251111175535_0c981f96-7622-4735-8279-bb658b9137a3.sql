-- Vytvoření tabulky pro šablony připomínek
CREATE TABLE IF NOT EXISTS public.reminder_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  remind_days_before INTEGER NOT NULL DEFAULT 30,
  repeat_interval_days INTEGER,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  target_user_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Povolit RLS
ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;

-- Každý může číst aktivní šablony
CREATE POLICY "Anyone can view active reminder templates" 
ON public.reminder_templates 
FOR SELECT 
USING (is_active = true);

-- Pouze admini a manažeři mohou vytvářet šablony
CREATE POLICY "Admins and managers can insert reminder templates" 
ON public.reminder_templates 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Pouze admini a manažeři mohou upravovat šablony
CREATE POLICY "Admins and managers can update reminder templates" 
ON public.reminder_templates 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Pouze admini a manažeři mohou mazat šablony
CREATE POLICY "Admins and managers can delete reminder templates" 
ON public.reminder_templates 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Trigger pro automatické aktualizace timestamps
CREATE TRIGGER update_reminder_templates_updated_at
BEFORE UPDATE ON public.reminder_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Přidat sloupec reminder_template_id do tabulky trainings (pokud ještě neexistuje)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'trainings' 
    AND column_name = 'reminder_template_id'
  ) THEN
    ALTER TABLE public.trainings 
    ADD COLUMN reminder_template_id UUID REFERENCES public.reminder_templates(id);
  END IF;
END $$;

-- Přidat výchozí šablony
INSERT INTO public.reminder_templates (name, description, remind_days_before, email_subject, email_body, is_active)
VALUES 
(
  'Základní připomínka 30 dní',
  'Standardní šablona pro připomínku 30 dní před vypršením platnosti',
  30,
  'Připomínka: Blíží se konec platnosti školení',
  'Dobrý den,

tímto vás informujeme, že za {{days_remaining}} dní vyprší platnost vašeho školení "{{training_name}}".

Prosím, zajistěte si co nejdříve absolvování opakovaného školení.

S pozdravem,
Systém správy školení',
  true
),
(
  'Urgentní připomínka 7 dní',
  'Urgentní šablona pro připomínku 7 dní před vypršením',
  7,
  'URGENTNÍ: Školení vyprší za týden!',
  'Dobrý den,

upozorňujeme, že platnost vašeho školení "{{training_name}}" vyprší již za {{days_remaining}} dní!

Je nezbytné, abyste si co nejdříve domluvili termín opakovaného školení.

S pozdravem,
Systém správy školení',
  true
),
(
  'Měsíční přehled',
  'Měsíční souhrnná připomínka všech blížících se školení',
  60,
  'Měsíční přehled školení',
  'Dobrý den,

zasíláme vám měsíční přehled školení, která se blíží:

{{training_list}}

Prosím, plánujte si včas absolvování těchto školení.

S pozdravem,
Systém správy školení',
  true
);