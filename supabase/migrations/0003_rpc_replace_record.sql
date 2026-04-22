create or replace function replace_record(
  old_id uuid,
  new_record jsonb
) returns records
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted records;
begin
  -- Delete old record only if caller owns it (RLS enforces this naturally).
  delete from records where id = old_id;

  insert into records (
    user_id, profile_id, kind, name, performed_on,
    dose_number, total_doses, notes, qr_fingerprint
  ) values (
    auth.uid(),
    (new_record->>'profile_id')::uuid,
    new_record->>'kind',
    new_record->>'name',
    (new_record->>'performed_on')::date,
    nullif(new_record->>'dose_number','')::int,
    nullif(new_record->>'total_doses','')::int,
    new_record->>'notes',
    new_record->>'qr_fingerprint'
  ) returning * into inserted;

  return inserted;
end;
$$;

grant execute on function replace_record(uuid, jsonb) to authenticated;
