-- medical_reminder_templates already existed (with a working admin UI under
-- Administrace → Emaily & Šablony → Šablony individuálních připomínek → PLP,
-- and a real FK from medical_examinations.reminder_template_id) but the actual
-- run-medical-reminders function never read from it — it only used the
-- system_settings "medical_email_template" blob. Editing a PLP template in
-- that UI silently had no effect on what was actually sent.
--
-- run-medical-reminders now reads its base subject/body from this table (see
-- supabase/functions/run-medical-reminders/index.ts), matching how trainings
-- and deadlines already work, with the settings blob kept as an optional
-- override on top (same pattern as deadlines).
--
-- Seed one active template from whatever was configured in the settings blob,
-- so existing configurations keep working instead of silently reverting to
-- the hardcoded default text.
INSERT INTO public.medical_reminder_templates (name, email_subject, email_body, is_active)
SELECT
  'Výchozí šablona (migrováno z nastavení)',
  COALESCE(s.value->>'subject', 'Souhrn lékařských prohlídek - {reportDate}'),
  COALESCE(s.value->>'body', 'Dobrý den,' || E'\n\n' || 'zasíláme přehled lékařských prohlídek vyžadujících pozornost.' || E'\n\n' || 'Celkem: {totalCount}' || E'\n' || '- Brzy vypršuje: {expiringCount}' || E'\n' || '- Prošlé: {expiredCount}'),
  true
FROM (SELECT 1) AS one_row
LEFT JOIN public.system_settings s ON s.key = 'medical_email_template'
WHERE NOT EXISTS (SELECT 1 FROM public.medical_reminder_templates);
