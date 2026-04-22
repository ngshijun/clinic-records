-- Allow standalone reminders that aren't linked to a record. When a clinic
-- issues a "come back in 2 weeks for a blood test" QR, the ingest creates
-- only a reminder (no record row), and we need the test name on the reminder
-- itself since there's no record to derive it from.
alter table reminders add column name text;
