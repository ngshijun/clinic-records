-- Categories for grouping qr_templates in the staff picker. Scoped per kind
-- (vaccines vs blood tests) so the same label can exist in both. RLS mirrors
-- qr_templates (shared clinic tablet threat model).
create table template_categories (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('v','b')),
  label       text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index template_categories_kind_order_idx
  on template_categories(kind, sort_order);

alter table template_categories enable row level security;

create policy "public read template_categories" on template_categories
  for select using (true);
create policy "public insert template_categories" on template_categories
  for insert with check (true);
create policy "public update template_categories" on template_categories
  for update using (true) with check (true);
create policy "public delete template_categories" on template_categories
  for delete using (true);

-- Link templates to a category. null = uncategorized. on delete set null so
-- deleting a category drops the grouping without destroying its templates.
alter table qr_templates
  add column category_id uuid references template_categories(id) on delete set null;
create index qr_templates_category_id_idx on qr_templates(category_id);
