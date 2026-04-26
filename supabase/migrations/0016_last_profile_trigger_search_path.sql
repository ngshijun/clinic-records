-- 0015's trigger function referenced `profiles` and `auth.users` without
-- forcing a search_path, so when gotrue (running as supabase_auth_admin
-- with no `public` in search_path) cascade-deleted a user, the deferred
-- check raised "relation \"profiles\" does not exist" at commit time.
-- Lock the function's search_path to empty and schema-qualify every
-- table reference so the same function works under any caller.

create or replace function check_user_has_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users where id = old.user_id)
     and not exists (select 1 from public.profiles where user_id = old.user_id)
  then
    raise exception 'cannot delete last profile — users must keep at least one'
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;
