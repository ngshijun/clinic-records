-- Track the unit (day / week / month / year) the staff user picked when
-- defining a template's next-due interval. Existing rows default to 'd' so
-- nothing about their behavior changes; new templates can set 'w' / 'mo' /
-- 'y' for calendar-anchored math (e.g. "1 year" lands on the same calendar
-- date next year, not 365 days later).
alter table qr_templates
  add column if not exists next_due_unit text not null default 'd'
    check (next_due_unit in ('d', 'w', 'mo', 'y'));
