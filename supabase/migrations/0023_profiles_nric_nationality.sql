-- Add NRIC + nationality to profiles.
--
-- `nric` is nullable so existing rows (created before this migration) keep
-- working. New profiles are enforced via the app's create() store function
-- to have it set; the database itself stays permissive so a backfill or
-- admin operation can leave older rows alone.
--
-- `nationality` is an ISO 3166-1 alpha-2 code (e.g. 'MY', 'SG', 'ID'). It's
-- the single source of truth for the patient's country of citizenship.
-- Existing rows backfill to 'MY' since the clinic operates in Malaysia and
-- those rows were captured before nationality was tracked. NRIC format
-- validation (12 digits) only applies when nationality = 'MY'; non-Malaysian
-- profiles can store free-form passport / ID strings.
alter table profiles
  add column nric text,
  add column nationality text not null default 'MY';

-- Identity uniqueness within a user account, but only for Malaysian NRICs —
-- non-Malaysian IDs are free-form (passports etc.) and not normalized, so
-- enforcing uniqueness on those would produce false collisions.
create unique index profiles_user_nric_idx
  on profiles(user_id, nric)
  where nationality = 'MY' and nric is not null;
