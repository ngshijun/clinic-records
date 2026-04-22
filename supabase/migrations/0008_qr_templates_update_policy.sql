-- Missed in 0006: qr_templates has select/insert/delete policies but no
-- update policy. With RLS enabled, updates silently match 0 rows — which
-- manifests as category_id assignments vanishing on refresh, since the move
-- call returns no error but also doesn't persist.
create policy "public update templates" on qr_templates
  for update using (true) with check (true);
