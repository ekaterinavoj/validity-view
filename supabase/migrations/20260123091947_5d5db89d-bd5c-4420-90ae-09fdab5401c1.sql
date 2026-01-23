-- Insert new system settings for reminder recipients and frequency
-- Only insert if they don't exist to avoid conflicts

INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('reminder_recipients', '{"user_ids": [], "delivery_mode": "bcc"}', 'List of user IDs to receive reminder emails and delivery mode (to/cc/bcc)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value, description)
VALUES 
  ('reminder_frequency', '{"type": "weekly", "interval_days": 7, "start_time": "08:00", "timezone": "Europe/Prague"}', 'Reminder frequency configuration: type (daily/weekly/biweekly/monthly/custom), interval, start time, timezone')
ON CONFLICT (key) DO NOTHING;