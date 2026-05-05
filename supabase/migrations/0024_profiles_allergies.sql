-- Add free-text allergies column to profiles.
--
-- Allergies are captured as a single text blob rather than a structured
-- table. Each allergy QR is a complete snapshot of the patient's known
-- allergies; scanning a new QR overwrites the previous text. Existing rows
-- get null (= no record taken yet) which the patient app distinguishes
-- from an empty/whitespace string (= "checked, no known allergies").
alter table profiles add column allergies text;
