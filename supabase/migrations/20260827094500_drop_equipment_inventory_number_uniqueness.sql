-- The hard UNIQUE constraint on equipment.inventory_number blocked legitimate
-- cases where two genuinely different pieces of equipment share the same
-- inventory number (e.g. numbering reused per facility, or numbers assigned by
-- an external system the company doesn't fully control). There was no way to
-- enter such equipment through the UI at all — the insert was rejected outright.
--
-- Duplicate detection already happens at the application layer where it
-- actually matters (bulk import, see src/components/BulkEquipmentImport.tsx),
-- using a composite key of inventory_number + name + equipment_type +
-- manufacturer + serial_number — i.e. equipment only counts as "the same
-- record" when ALL of those match, not just the inventory number.

ALTER TABLE public.equipment DROP CONSTRAINT IF EXISTS equipment_inventory_number_key;
