create or replace function prevent_last_profile_delete()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from profiles where user_id = old.user_id) <= 1 then
    raise exception 'cannot delete last profile — users must keep at least one'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger profiles_last_delete_guard
  before delete on profiles
  for each row
  execute function prevent_last_profile_delete();
