-- 0016 fixed the search_path so gotrue's user-delete cascade could
-- resolve `public.profiles`, but the cascade then fell over on
-- "permission denied for table profiles" — the supabase_auth_admin
-- role gotrue runs as has no privileges on public.*. Mark the
-- function security definer so it runs with the owner's (postgres)
-- privileges; combined with the empty search_path locked in 0016,
-- this is the standard Supabase pattern for cross-schema triggers.

create or replace function check_user_has_profile()
returns trigger
language plpgsql
security definer
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
