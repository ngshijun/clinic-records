alter table reminders add column if not exists sent_count int not null default 0;

-- Lock legacy reminders that were already sent once so they don't fire again
-- under the new 3-times-per-day cadence. New reminders start at 0.
update reminders set sent_count = 3 where sent_at is not null;
