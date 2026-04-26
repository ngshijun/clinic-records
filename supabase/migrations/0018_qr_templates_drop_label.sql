-- The label column was a redundant denormalization of name + dose + due-days,
-- which the UI already renders directly from those source fields. Dropping it
-- removes a write-only column and the save-time prompt that captured it.
alter table qr_templates drop column label;
