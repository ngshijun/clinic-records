-- The original 0004 guard fired BEFORE DELETE per row, so cascading
-- a user delete (which removes every profile owned by that user)
-- raised P0001 on the last row. Convert it to a DEFERRABLE constraint
-- trigger checked at end of transaction: at that point, if the user
-- row is gone, the check passes vacuously; if the user remains and
-- has zero profiles, the original invariant still raises.

drop trigger if exists profiles_last_delete_guard on profiles;
drop function if exists prevent_last_profile_delete();

create or replace function check_user_has_profile()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from auth.users where id = old.user_id)
     and not exists (select 1 from profiles where user_id = old.user_id)
  then
    raise exception 'cannot delete last profile — users must keep at least one'
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create constraint trigger profiles_last_delete_guard
  after delete on profiles
  deferrable initially deferred
  for each row
  execute function check_user_has_profile();
