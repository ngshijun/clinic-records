import { supabase } from '@/lib/supabase'

export interface Template {
  id: string
  kind: 'v' | 'b'
  name: string
  dose_number: number | null
  total_doses: number | null
  next_due_days: number | null
  reminder_only: boolean
  category_id: string | null
  sort_order: number
  created_at: string
}

export type TemplateInput = Omit<Template, 'id' | 'created_at' | 'category_id' | 'sort_order'> & { category_id?: string | null }

export interface TemplateCategory {
  id: string
  kind: 'v' | 'b'
  label: string
  sort_order: number
  created_at: string
}

export async function listTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('qr_templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Template[]
}

export async function saveTemplate(input: TemplateInput): Promise<Template> {
  const targetCategoryId = input.category_id ?? null
  // New templates land at the end of their (kind, category) bucket, mirroring
  // createCategory's "max sort_order + 1" pattern.
  let q = supabase
    .from('qr_templates')
    .select('sort_order')
    .eq('kind', input.kind)
  q = targetCategoryId === null ? q.is('category_id', null) : q.eq('category_id', targetCategoryId)
  const { data: existing, error: e1 } = await q
    .order('sort_order', { ascending: false })
    .limit(1)
  if (e1) throw e1
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('qr_templates')
    .insert({
      kind: input.kind,
      name: input.name,
      dose_number: input.dose_number,
      total_doses: input.total_doses,
      next_due_days: input.next_due_days,
      reminder_only: input.reminder_only,
      category_id: targetCategoryId,
      sort_order: nextOrder,
    })
    .select()
    .single()
  if (error) throw error
  return data as Template
}

export async function reorderTemplates(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return
  const { error } = await supabase.rpc('reorder_qr_templates', { template_ids: orderedIds })
  if (error) throw error
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('qr_templates').delete().eq('id', id)
  if (error) throw error
}

export async function moveTemplateToCategory(templateId: string, categoryId: string | null): Promise<void> {
  const { error } = await supabase
    .from('qr_templates')
    .update({ category_id: categoryId })
    .eq('id', templateId)
  if (error) throw error
}

export async function listCategories(): Promise<TemplateCategory[]> {
  const { data, error } = await supabase
    .from('template_categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as TemplateCategory[]
}

export async function createCategory(kind: 'v' | 'b', label: string): Promise<TemplateCategory> {
  const { data: existing, error: e1 } = await supabase
    .from('template_categories')
    .select('sort_order')
    .eq('kind', kind)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (e1) throw e1
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1
  const { data, error } = await supabase
    .from('template_categories')
    .insert({ kind, label: label.trim().toUpperCase(), sort_order: nextOrder })
    .select()
    .single()
  if (error) throw error
  return data as TemplateCategory
}

export async function renameCategory(id: string, label: string): Promise<void> {
  const { error } = await supabase
    .from('template_categories')
    .update({ label: label.trim().toUpperCase() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('template_categories').delete().eq('id', id)
  if (error) throw error
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) =>
    supabase.from('template_categories').update({ sort_order: i }).eq('id', id),
  )).then((results) => {
    const bad = results.find(r => r.error)
    if (bad?.error) throw bad.error
  })
}

