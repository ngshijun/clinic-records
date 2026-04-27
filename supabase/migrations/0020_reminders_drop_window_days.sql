-- window_days was a vestigial firing-window control from the original schema
-- (0001) and never wired into the cron or any consumer. The current cron uses
-- a fixed three-slot/day cadence gated by sent_count, so this column is dead.
alter table reminders drop column if exists window_days;
