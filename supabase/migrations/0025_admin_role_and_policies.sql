-- Cross-account admin role for clinic staff.
--
-- The clinic operates a single shared Supabase account whose password is the
-- staff PIN (its email reaches the client as VITE_ADMIN_EMAIL). That account is
-- listed in `admins`; is_admin() lets new RLS policies grant it read/write
-- across every patient's rows. The existing per-user "own X" policies are
-- untouched and OR with these, so a normal patient still sees only their own
-- data. This is a deliberate escalation from the prior "junk-QR" threat model:
-- the PIN now gates read+write of all patient PHI, so it is a real, server-
-- verified account password rather than a client-side hash.

create table admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;
-- Intentionally no policies: authenticated users cannot read or modify this
-- table directly. is_admin() reads it as SECURITY DEFINER (bypassing RLS).

create or replace function is_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Full CRUD on clinical rows for the admin...
create policy "admin all records" on records
  for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "admin all reminders" on reminders
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- ...read-only on profiles (identity stays patient-owned)...
create policy "admin read profiles" on profiles
  for select to authenticated
  using (is_admin());

-- ...and a narrow, column-scoped write for allergies only, so name/NRIC/DOB
-- cannot be changed by admin even though they sit on the same row.
create or replace function admin_set_allergies(p_profile_id uuid, p_allergies text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.profiles
     set allergies = p_allergies, updated_at = now()
   where id = p_profile_id;
end;
$$;

grant execute on function is_admin() to authenticated;
grant execute on function admin_set_allergies(uuid, text) to authenticated;
