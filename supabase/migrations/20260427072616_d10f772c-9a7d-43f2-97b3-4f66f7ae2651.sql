-- Seed klíče security_checklist_state v system_settings (pokud neexistuje)
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'security_checklist_state',
  jsonb_build_object('items', '{}'::jsonb, 'updated_by', NULL, 'updated_at', NULL),
  'Sdílený stav položek Security Hardening Checklistu (zaškrtnuté/nezaškrtnuté). Editují pouze admini.'
)
ON CONFLICT (key) DO NOTHING;

-- Záznam do registru migrací
INSERT INTO public.schema_migrations (version, name, checksum)
VALUES (
  '20260427_security_checklist_state',
  'security_checklist_shared_state',
  'seed_security_checklist_state_v1'
)
ON CONFLICT (version) DO NOTHING;