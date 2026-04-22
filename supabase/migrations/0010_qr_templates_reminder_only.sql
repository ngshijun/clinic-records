-- Persist the reminder-only flag on qr_templates so staff don't have to
-- re-tick the toggle every time they apply a reminder-style template.
alter table qr_templates
  add column reminder_only boolean not null default false;
