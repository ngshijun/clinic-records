-- Sort_order for templates within their (kind, category_id) bucket. The
-- previous ordering was created_at-only, which gave staff no control over
-- the picker order; sort_order lets them drag templates to arrange them.
alter table qr_templates add column sort_order int not null default 0;

-- Backfill so existing rows match the order users currently see.
update qr_templates qt
set sort_order = sub.rn - 1
from (
  select id, row_number() over (
    partition by kind, category_id
    order by created_at
  ) as rn
  from qr_templates
) sub
where qt.id = sub.id;

create index qr_templates_kind_category_sort_idx
  on qr_templates(kind, category_id, sort_order);

-- Atomic bulk reorder. Renumbers the given templates 0..n-1 in array order
-- in a single UPDATE so concurrent readers never observe inconsistent state.
-- Caller is expected to pass the IDs of one (kind, category_id) bucket;
-- sort_order is local to a bucket so cross-bucket calls are never needed.
create or replace function reorder_qr_templates(template_ids uuid[])
returns void
language sql
as $$
  update qr_templates qt
  set sort_order = sub.idx - 1
  from unnest(template_ids) with ordinality as sub(id, idx)
  where qt.id = sub.id;
$$;
