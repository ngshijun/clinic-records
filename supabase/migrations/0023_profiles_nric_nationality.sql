-- Add NRIC and Malaysian-citizen flag to profiles.
--
-- `nric` is nullable so existing rows (created before this migration) keep
-- working. New profiles created via the app's create() store function are
-- enforced to have it set, but the database itself stays permissive so a
-- backfill or admin operation can leave older rows alone.
--
-- `is_malaysian` defaults to true because the clinic operates in Malaysia
-- and the overwhelming majority of existing patients are Malaysian. A
-- non-Malaysian flag is then set explicitly during creation when the
-- patient confirms otherwise.
alter table profiles
  add column nric text,
  add column is_malaysian boolean not null default true;

-- Optional helper for future lookups (one-row-per-patient identity check).
-- Partial unique constraint: NRIC must be unique among Malaysians within
-- the same user account; non-Malaysians can repeat free-form ID strings
-- since those are entered as passports/whatever and aren't normalized.
create unique index profiles_user_nric_idx
  on profiles(user_id, nric)
  where is_malaysian and nric is not null;
