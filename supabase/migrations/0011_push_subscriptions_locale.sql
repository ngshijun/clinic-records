alter table push_subscriptions
  add column if not exists locale text not null default 'en';
