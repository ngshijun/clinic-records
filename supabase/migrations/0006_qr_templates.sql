-- Clinic-wide QR templates. Staff-facing only; no user_id because staff
-- authenticate via a shared password (not Supabase Auth). RLS is permissive
-- to match the existing "security boundary is the physical clinic tablet"
-- threat model — if the staff password leaks, anyone could already print junk
-- QRs; allowing junk templates is the same class of nuisance.
create table qr_templates (
  id            uuid primary key default gen_random_uuid(),
  label         text not null,
  kind          text not null check (kind in ('v','b')),
  name          text not null,
  dose_number   int,
  total_doses   int,
  next_due_days int,
  created_at    timestamptz not null default now()
);
create index qr_templates_kind_idx on qr_templates(kind, created_at desc);

alter table qr_templates enable row level security;

-- Applies to every role (anon + authenticated); no auth.uid() check.
create policy "public read templates" on qr_templates
  for select using (true);
create policy "public insert templates" on qr_templates
  for insert with check (true);
create policy "public delete templates" on qr_templates
  for delete using (true);
