-- Insert default deadline_reminder_frequency setting (independent from training)
INSERT INTO system_settings (key, value, description)
VALUES (
  'deadline_reminder_frequency',
  '{"type": "weekly", "interval_days": 7, "start_time": "08:00", "timezone": "Europe/Prague", "enabled": true}'::jsonb,
  'Frekvence odesílání souhrnů technických událostí (nezávislé na školení)'
)
ON CONFLICT (key) DO NOTHING;

-- Insert default deadline_reminder_schedule setting
INSERT INTO system_settings (key, value, description)
VALUES (
  'deadline_reminder_schedule',
  '{"enabled": true, "day_of_week": 1, "skip_weekends": true}'::jsonb,
  'Rozvrh odesílání souhrnů technických událostí'
)
ON CONFLICT (key) DO NOTHING;