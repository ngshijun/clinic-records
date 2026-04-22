-- Profiles: one per person being tracked on an account
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  date_of_birth date,
  notes         text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index profiles_user_id_idx on profiles(user_id);

-- Records: vaccinations and blood tests (union)
create table records (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  profile_id     uuid not null references profiles(id) on delete cascade,
  kind           text not null check (kind in ('vaccination','blood_test')),
  name           text not null,
  performed_on   date not null,
  dose_number    int,
  total_doses    int,
  notes          text,
  qr_fingerprint text unique,
  created_at     timestamptz not null default now()
);
create index records_profile_id_idx on records(profile_id);
create index records_user_id_performed_on_idx on records(user_id, performed_on desc);

-- Reminders: "dose 2 due around May 22"
create table reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  record_id     uuid references records(id) on delete cascade,
  kind          text not null check (kind in ('next_dose','followup_test','other')),
  title         text not null,
  due_at        timestamptz not null,
  window_days   int not null default 7,
  sent_at       timestamptz,
  dismissed_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index reminders_due_at_idx on reminders(due_at) where sent_at is null;
create index reminders_user_id_idx on reminders(user_id);

-- Push subscriptions: one row per device that opted in
create table push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on push_subscriptions(user_id);
