-- Doplnění popisu k záznamu sdíleného Security Checklistu
-- (no-op pokud záznam neexistuje; čistě dokumentační aktualizace)
UPDATE public.system_settings
SET description = 'Sdílený stav Security Hardening Checklistu (zaškrtnutí jsou viditelná všem administrátorům, ukládá se do DB).'
WHERE key = 'security_checklist_state';