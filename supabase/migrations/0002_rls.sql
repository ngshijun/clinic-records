alter table profiles enable row level security;
alter table records enable row level security;
alter table reminders enable row level security;
alter table push_subscriptions enable row level security;

create policy "own profiles" on profiles
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own records" on records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own reminders" on reminders
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own push_subs" on push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
